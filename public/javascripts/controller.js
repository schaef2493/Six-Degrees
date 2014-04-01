var socket = io.connect(window.location.hostname);

var activeTask = null;
var playbackPaused = false;
var playbackEnded = false;
var deletePending = null;
var typingTimer;
var doneTypingInterval = 1000; // ms
var tap = new Audio('../sounds/tap.mp3');
var beep = new Audio('../sounds/playback.mp3');
var movingHome = false;

socket.on('playbackFinished', function (data) {
	beep.play();
	playbackEnded = true;
	playbackPaused = true;
	$('#playbackButton .bottomInner').removeClass('active');
});

$(document).ready(function() {

	socket.on('tasks', function (data) {
		var tasks = data.tasks;

		$('#taskList').html('');

		for (var i=0; i<tasks.length; i++) {
			$('#taskList').append('<div class="task">' + tasks[i] + '</div>');
		}

		$('#taskList').append('<div class="task">+ New Task</div>');
	});

	socket.on('finishedMovingHome', function(data) {
		beep.play();
		movingHome = false;
		$('#advanceToRecord').removeClass('dim');
		$('#beginRecordingBtn').html('Begin Recording');
	});

	$('body').on('touchstart', '.task', function(e) {
	  if (e.target.innerText != '+ New Task') {
	  	pressTimer = Date.now();
	  	deletePending = e.target.innerText;
	  	setTimeout(performDelete, 1000);
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

	$('body').hammer().on('tap', '.task', function(e) {
	  deletePending = null;
	  tap.play();

	  $('#playbackInner').html('Hold to begin playback');

	  if (e.target.innerText == '+ New Task') {
	  	// record new task
	  	$('#home').toggleClass('hidden');
	  	$('#record_name').toggleClass('hidden');
	  	$('#name').focus();
	  	socket.emit('moveHome');
	  	movingHome = true;
	  	$('#advanceToRecord').addClass('dim');
	  } else {
	  	activeTask = e.target.innerText;
	  
	  	// playback task
	  	$('#home').toggleClass('hidden');
	  	$('#playback').toggleClass('hidden');
	  }
	});

	$('#playbackBack').hammer().on('tap', function(e) {
		tap.play();
		$('.screen').addClass('hidden');
		$('#home').removeClass('hidden');
		e.stopPropagation();
		activeTask = null;
		playbackPaused = false;
		playbackEnded = false;
		e.stopPropagation();
		return false;
	});

	$('#playbackButton').hammer().on('touchstart', function(e) {
		beep.play();

		$('#playbackButton .bottomInner').addClass('active');
		$('#playbackInner').html('Release to pause playback');

		if (playbackEnded && playbackPaused) {
			playbackPaused = false;
			playbackEnded = false;
		}

		if (playbackPaused) {
			socket.emit('resumePlayback', { task: activeTask });
		} else {
			socket.emit('startPlayback', { task: activeTask });
		}
	});

	$('#playbackButton').hammer().on('touchend', function(e) {
		beep.play();

		$('#playbackButton .bottomInner').removeClass('active');
		$('#playbackInner').html('Hold to resume playback');

		playbackPaused = true;
		socket.emit('pausePlayback');
	});

	$('#recordBack').hammer().on('tap', function(e) {
		tap.play();

		$('.screen').addClass('hidden');
		$('#home').removeClass('hidden');
		activeTask = null;
	});

	$('#name').keyup(function(){
	    clearTimeout(typingTimer);
	    typingTimer = setTimeout(doneTyping, doneTypingInterval);
	});

	$('#name').keydown(function(){
	    clearTimeout(typingTimer);
	});

	function doneTyping () {
	    $('#name').blur();
	}

	$('#advanceToRecord').hammer().on('tap', function(e) {
		if (movingHome) {
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

});