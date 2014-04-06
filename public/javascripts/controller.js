var socket = io.connect(window.location.hostname);

var activeTask = null;
var deletePending = null;
var tap = new Audio('../sounds/tap.mp3');
var beep = new Audio('../sounds/playback.mp3');
var movingHome = false;

socket.on('finishedMovingHome', function(data) {
	movingHome = false;
	$('#beginRecording').html('Begin Recording');
	$('#beginRecording').addClass('active');
});

$(document).ready(function() {

	// Generate task list

	socket.on('tasks', function (data) {
		var tasks = data.tasks;

		$('#taskList').html('');

		for (var i=0; i<tasks.length; i++) {
			$('#taskList').append('<div class="task">' + tasks[i] + '</div>');
		}

		$('#taskList').append('<div class="task">+ New Task</div>');
	});

	// Control mode toggling

	$('#normal').hammer().on('tap', function() {
		$('.task').removeClass('active');
		$("#buttonGrid .button").removeClass('active');
		$('#normal').addClass('active');
		tap.play();
		socket.emit('cartesianMode');
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
		$("#buttonGrid .button").removeClass('active');
		$('#gripper').addClass('active');
		tap.play();
		socket.emit('gripperMode');
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
		$("#buttonGrid .button").removeClass('active');
		$('#wrist').addClass('active');
		tap.play();
		socket.emit('wristMode');
	});

	$('#wristRec').hammer().on('tap', function() {
		$('.task').removeClass('active');
		$("#buttonGrid .button").removeClass('active');
		$('#wristRec').addClass('active');
		tap.play();
		socket.emit('wristMode');
	});

	// Handle taps on the task list

	$('body').hammer().on('tap', '.task', function(e) {
	  deletePending = null;
	  tap.play();

	  if (e.target.innerText == '+ New Task') {
	  	// Record new task
	  	$('#home').toggleClass('hidden');
	  	$('#record_name').toggleClass('hidden');
	  	$('#beginRecording').removeClass('active');
	  	$('#name').focus();
	  	movingHome = true;
	  	socket.emit('moveHome');
	  } else {
	  	if (e.target.innerText != activeTask) {
	  		socket.emit('startPlayback', { task: activeTask });
	  	}

	  	activeTask = e.target.innerText;
	  	$('.task').removeClass('active');
	  	$('#buttonGrid .button').removeClass('active');
	 	$(e.target).addClass('active');
	  }
	});

	// Recording flow

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

		socket.emit('startRecording', { task: activeTask });
	});

	$('#finishRecording').hammer().on('tap', function(e) {
		tap.play();

		$('#name').val('');
		$('#taskList').prepend('<div class="task">' + activeTask + '</div>');
		$('#beginRecording').html('Please Wait');

		$('.screen').addClass('hidden');
		$('#home').removeClass('hidden');
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