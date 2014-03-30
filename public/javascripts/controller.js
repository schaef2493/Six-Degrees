var socket = io.connect(window.location.hostname);

var activeTask = null;
var playbackPaused = false;
var playbackEnded = false;
var deletePending = null;

socket.on('playbackEnded', function (data) {
	playbackEnded = true;
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

	$('body').hammer().on('tap', '.task', function(e) {
	  deletePending = null;

	  if (e.target.innerText == '+ New Task') {
	  	// record new task
	  	$('#home').toggleClass('hidden');
	  	$('#record_name').toggleClass('hidden');
	  } else {
	  	activeTask = e.target.innerText;
	  
	  	// playback task
	  	$('#home').toggleClass('hidden');
	  	$('#playback').toggleClass('hidden');
	  }
	});

	$('#playbackBack').hammer().on('tap', function(e) {
		$('.screen').addClass('hidden');
		$('#home').removeClass('hidden');
		e.stopPropagation();
		activeTask = null;
		playbackPaused = false;
		playbackEnded = false;
	});

	$('#playbackBack').hammer().on('tap', function(e) {
		e.stopPropagation();
	});

	$('#playback').hammer().on('tap', function(e) {
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

	$('#playback').hammer().on('tap', function(e) {
		playbackPaused = true;
		socket.emit('pausePlayback');
	});

	$('#recordBack').hammer().on('tap', function(e) {
		$('.screen').addClass('hidden');
		$('#home').removeClass('hidden');
		activeTask = null;
	});

	$('#advanceToRecord').hammer().on('tap', function(e) {
		activeTask = $('#name').val();

		$('.screen').addClass('hidden');
		$('#record_movements').removeClass('hidden');

		socket.emit('startRecording', { task: activeTask });
	});

	$('#backToName').hammer().on('tap', function(e) {
		socket.emit('endRecording');

		$('.screen').addClass('hidden');
		$('#record_name').removeClass('hidden');
	});

	$('#finishRecording').hammer().on('tap', function(e) {
		$('#name').val('');
		$('#taskList').prepend('<div class="task">' + activeTask + '</div>');

		$('.screen').addClass('hidden');
		$('#home').removeClass('hidden');

		activeTask = null;
		socket.emit('endRecording');
	});

});