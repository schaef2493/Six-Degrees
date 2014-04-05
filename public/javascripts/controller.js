var socket = io.connect(window.location.hostname);

var activeTask = null;
var playbackPaused = false;
var playbackEnded = false;
var deletePending = null;
var tap = new Audio('../sounds/tap.mp3');
var beep = new Audio('../sounds/playback.mp3');
var movingHome = false;

socket.on('playbackFinished', function (data) {
	beep.play();
	playbackEnded = true;
	playbackPaused = true;
	$('#playbackButton .bottomInner').removeClass('active');
});

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
		// TODO: SEND MODE MESSAGE
	});

	$('#gripper').hammer().on('tap', function() {
		$('.task').removeClass('active');
		$("#buttonGrid .button").removeClass('active');
		$('#gripper').addClass('active');
		tap.play();
		// TODO: SEND MODE MESSAGE
	});

	$('#wrist').hammer().on('tap', function() {
		$('.task').removeClass('active');
		$("#buttonGrid .button").removeClass('active');
		$('#wrist').addClass('active');
		tap.play();
		// TODO: SEND MODE MESSAGE
	});

	// Handle taps on the task list

	$('body').hammer().on('tap', '.task', function(e) {
	  deletePending = null;
	  tap.play();

	  if (e.target.innerText == '+ New Task') {
	  	// record new task
	  	$('#home').toggleClass('hidden');
	  	$('#record_name').toggleClass('hidden');
	  	$('#beginRecording').removeClass('active');
	  	$('#name').focus();
	  	movingHome = true;
	  	socket.emit('moveHome');
	  } else {
	  	activeTask = e.target.innerText;
	  	$('.task').removeClass('active');
	  	$('#buttonGrid .button').removeClass('active');
	 	$(e.target).addClass('active');
	  }
	});

	// Recording flow

	$('#recordBack').hammer().on('tap', function(e) {
		tap.play();

		$('.screen').addClass('hidden');
		$('#home').removeClass('hidden');
		activeTask = null;
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

		socket.emit('startRecording', { task: activeTask });
	});

	$('#finishRecording').hammer().on('tap', function(e) {
		tap.play();

		$('#name').val('');
		$('#taskList').prepend('<div class="task">' + activeTask + '</div>');

		$('.screen').addClass('hidden');
		$('#home').removeClass('hidden');

		activeTask = null;
		socket.emit('endRecording');
	});

	// Task deletions

	$('body').on('touchstart', '.task', function(e) {
	  if (e.target.innerText != '+ New Task') {
	  	pressTimer = Date.now();
	  	deletePending = e.target.innerText;
	  	setTimeout(performDelete, 2000);
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