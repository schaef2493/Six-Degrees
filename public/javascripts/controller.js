var socket = io.connect(window.location.hostname);

var activeTask = null;
var playbackPaused = false;
var playbackEnded = false;

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

	$('body').on('touchend', '.task', function(e) {
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

	$('#playbackBack').on('touchend', function(e) {
		$('.screen').addClass('hidden');
		$('#home').removeClass('hidden');
		e.stopPropagation();
		activeTask = null;
		playbackPaused = false;
		playbackEnded = false;
	});

	$('#playbackBack').on('touchstart', function(e) {
		e.stopPropagation();
	});

	$('#playback').on('touchstart', function(e) {
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

	$('#playback').on('touchend', function(e) {
		playbackPaused = true;
		socket.emit('pausePlayback');
	});

	$('#recordBack').on('touchend', function(e) {
		$('.screen').addClass('hidden');
		$('#home').removeClass('hidden');
		activeTask = null;
	});

	$('#advanceToRecord').on('touchend', function(e) {
		activeTask = $('#name').val();

		$('.screen').addClass('hidden');
		$('#record_movements').removeClass('hidden');

		socket.emit('startRecording', { task: activeTask });
	});

	$('#backToName').on('touchend', function(e) {
		socket.emit('endRecording');

		$('.screen').addClass('hidden');
		$('#record_name').removeClass('hidden');
	});

	$('#finishRecording').on('touchend', function(e) {
		$('#name').val('');
		$('#taskList').prepend('<div class="task">' + activeTask + '</div>');

		$('.screen').addClass('hidden');
		$('#home').removeClass('hidden');

		activeTask = null;
		socket.emit('endRecording');
	});

});