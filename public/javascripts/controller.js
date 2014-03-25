var socket = io.connect(window.location.hostname);

window.onbeforeunload = function() {
	socket.onclose = function () {}; // disable onclose handler first
    socket.close()
};

socket.on('tasks', function (data) {
  console.log(data);
});