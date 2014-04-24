var socket = io.connect(window.location.hostname);

var activeTask = null;
var deletePending = null;
var tap = new Audio('../sounds/tap.mp3');
var beep = new Audio('../sounds/playback.mp3');
var reset = new Audio('../sounds/reset.mp3');
var movingHome = false;
var restartInProgress = false;

socket.on('finishedMovingHome', function(data) {
	console.log('FINISHED MOVING HOME');
	movingHome = false;
	if (activeTask) {
		$('#loading').addClass('hidden');
		beep.play();
	} else {
		$('#beginRecording').html('Begin Recording');
		$('#beginRecording').addClass('active');
	}
});

socket.on('alreadyFinishedMovingHome', function(data) {
	console.log('FINISHED MOVING HOME');
	movingHome = false;
	if (activeTask) {
		$('#loading').addClass('hidden');
	} else {
		$('#beginRecording').html('Begin Recording');
		$('#beginRecording').addClass('active');
	}
});

$(document).ready(function() {

	alert('Remember to home the robot');

	// Generate task list

	socket.on('tasks', function (data) {
		var tasks = data.tasks;

		$('#taskList').html('');

		for (var i=0; i<tasks.length; i++) {
			$('#taskList').append('<div class="task"><span>' + tasks[i] + '</span><div class="progressBar"></div></div>');
		}

		$('#taskList').prepend('<div class="task">+ New Task</div>');
	});

	socket.on('playbackFinished', function (data) {
		$('.task').removeClass('active');
		$('#restartTaskPlayback').remove();
		activeTask = null;
		$("#buttonGrid .button").removeClass('active');
		$('#normal').addClass('active');
		beep.play();
	});

	// Control mode toggling

	$('#normal').hammer().on('tap', function() {
		$('.task').removeClass('active');
		$('#restartTaskPlayback').remove();
		$("#buttonGrid .button").removeClass('active');
		$('#normal').addClass('active');
		tap.play();
		socket.emit('cartesianMode');
		//activeTask = null;
	});

	$('#normalRec').hammer().on('tap', function() {
		$('.task').removeClass('active');
		$("#buttonGrid .button").removeClass('active');
		$('#normalRec').addClass('active');
		tap.play();
		socket.emit('cartesianMode');
	});

	$('#gripper').hammer().on('tap', function() {
		$('.task').removeClass('active');
		$('#restartTaskPlayback').remove();
		$("#buttonGrid .button").removeClass('active');
		$('#gripper').addClass('active');
		tap.play();
		socket.emit('gripperMode');
		//activeTask = null;
	});

	$('#gripperRec').hammer().on('tap', function() {
		$('.task').removeClass('active');
		$("#buttonGrid .button").removeClass('active');
		$('#gripperRec').addClass('active');
		tap.play();
		socket.emit('gripperMode');
	});

	$('#wrist').hammer().on('tap', function() {
		$('.task').removeClass('active');
		$('#restartTaskPlayback').remove();
		$("#buttonGrid .button").removeClass('active');
		$('#wrist').addClass('active');
		tap.play();
		socket.emit('wristMode');
		//activeTask = null;
	});

	$('#wristRec').hammer().on('tap', function() {
		$('.task').removeClass('active');
		$("#buttonGrid .button").removeClass('active');
		$('#wristRec').addClass('active');
		tap.play();
		socket.emit('wristMode');
	});

	$('body').hammer().on('tap', '#restartTaskPlayback', function(e) {
		tap.play();
		movingHome = true;
		socket.emit('restartTaskPlayback');
		socket.emit('moveHome');
		$('#loading').removeClass('hidden');
		deletePending = null;
	});

	// Handle taps on the task list

	$('body').hammer().on('tap', '.task', function(e) {
		if (movingHome) {
			return;
		}

	  deletePending = null;
	  tap.play();

	  if (e.target.innerText == '+ New Task') {
	  	// Record new task
	  	$('#home').toggleClass('hidden');
	  	$('#record_name').toggleClass('hidden');
	  	$('#beginRecording').removeClass('active');
	  	$('#name').focus();
	  	activeTask = null;
	  	movingHome = true;
	  	socket.emit('moveHome');
	  } else {
	  	$('.task').removeClass('active');
	  	$('#restartTaskPlayback').remove();

	  	if (e.target.innerText != '') {
	  		if (activeTask != e.target.innerText) {
		  		socket.emit('moveHome');
		  		movingHome = true;
		  		$('#loading').removeClass('hidden');
		  	}

	 		$(e.target).parent().addClass('active');
	 		activeTask = e.target.innerText;
	 		$(e.target).parent().append('<div id="restartTaskPlayback"></div>');

	 	} else {
	 		
	 		if (activeTask != $(e.target).parent()[0].innerText) {
	  			socket.emit('moveHome');
	  			movingHome = true;
	  			$('#loading').removeClass('hidden');
	  		}

	 		$($(e.target).parent()[0]).addClass('active');
	 		debug = $($(e.target).parent()[0]);
	 		activeTask = $(e.target).parent()[0].innerText;
	 		$($(e.target).parent()[0]).append('<div id="restartTaskPlayback"></div>');
	 	}

	  	socket.emit('startPlayback', { task: activeTask });
	  	$('#buttonGrid .button').removeClass('active');	
	  }
	});

	// Recording flow

	$('#cancelRecording').hammer().on('tap', function(e) {
		tap.play();
		$('#home').toggleClass('hidden');
	  	$('#record_name').toggleClass('hidden');
	  	$('#beginRecording').removeClass('active');
	  	$('#restartTaskPlayback').remove();
	  	$('.task').removeClass('active');
		$('#buttonGrid .button').removeClass('active');
		$('#beginRecording').html('Please Wait');
		$('#normal').addClass('active');
		socket.emit('cartesianMode');
		$('#name').val('');
	  	movingHome = false;
	});

	$('#beginRecording').hammer().on('tap', function(e) {
		if (movingHome) {
			alert('Please wait until arm has finished moving.');
			return;
		}

		tap.play();
		activeTask = $('#name').val();

		if (activeTask == '') {
			alert("Task name cannot be empty");
			return false;
		}

		$('#name').blur();
		$($('#record_movements .instructions')[0]).html('Use the joystick to demonstrate the task');
		$('.screen').addClass('hidden');
		$('#record_movements').removeClass('hidden');
		$("#record_movements #buttonGrid .button").removeClass('active');
		$('#normalRec').addClass('active');

		socket.emit('startRecording', { task: activeTask });
	});

	$('#clearRecording').hammer().on('tap', function(e) {
		socket.emit('delete', { task: deletePending });
		tap.play();
		socket.emit('moveHome');
		movingHome = true;
		setTimeout("socket.emit('startRecording', { task: activeTask })", 8000);
	});

	$('#finishRecording').hammer().on('tap', function(e) {
		tap.play();

		$('#name').val('');
		$('#taskList').append('<div class="task">' + activeTask + '</div>');
		$('#beginRecording').html('Please Wait');

		$('.screen').addClass('hidden');
		$('#home').removeClass('hidden');

		$('.task').removeClass('active');
		$('#restartTaskPlayback').remove();
		$("#buttonGrid .button").removeClass('active');
		$('#normal').addClass('active');

		activeTask = null;
		socket.emit('endRecording');
		socket.emit('cartesianMode');
	});

	// Task deletions

	$('body').on('touchstart', '.task', function(e) {
	  if (e.target.innerText != '+ New Task') {
	  	pressTimer = Date.now();
	  	deletePending = e.target.innerText;
	  	setTimeout(performDelete, 3500);
	  }
	});

	function performDelete() {
		if (deletePending != null) {
			var c = confirm("Are you want to delete " + deletePending + '?');
			if (c) {
				socket.emit('delete', { task: deletePending });
			}

			deletePending = null;
		}
	}

	$('#taskList').scroll(function() {
	  deletePending = null;
	});

});