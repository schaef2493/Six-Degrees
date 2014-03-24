// connect socket
var socket = io.connect(window.location.hostname);

// connect to ROS
var ros = new ROSLIB.Ros();

ros.on('error', function(error) {
  console.log(error);
});

ros.on('connection', function() {
  console.log('Connection made!');
});

// create a connection to rosbridge 
ros.connect('ws://localhost:9090');

// configure the joystick topic
var joystick = new ROSLIB.Topic({
  ros: ros,
  name: '/joy',
  messageType: 'sensor_msgs/Joy'
});

joystick.subscribe(function(message) {
  socket.emit('movement', { axes: message.axes });
});

function moveArm(axes) {
  console.log('Moving arm to ' + axes);

  var message = new ROSLIB.Message({
    axes: axes,
    buttons: [0,0]
  });

  // TODO: TRACK BUTTONS
  // TODO: THROTTLE DATA

  joystick.publish(message);
}

// listen for movement commands
socket.on('moveJoystick', function (data) {
  moveArm(data.axes);
});