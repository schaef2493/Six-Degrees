var socket = io.connect(window.location.hostname);

socket.on('tasks', function (data) {
  console.log(data);
});