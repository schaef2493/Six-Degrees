var socket = io.connect(window.location.hostname);

socket.on('status', function (data) {
    console.log(data);
});