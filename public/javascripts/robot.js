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

function sendMovement(data) {
  socket.emit('movement', { axes: data.axes, header: data.header });
}

var sendMovementThrottled = _.throttle(sendMovement, 10);

joystick.subscribe(function(message) {
  sendMovementThrottled(message);
  //sendMovement(message);
});

function moveArm(axes) {
  console.log('Moving arm to ' + axes);

  var message = new ROSLIB.Message({
    axes: axes,
    buttons: [0,0]
  });

  joystick.publish(message);
}

// listen for movement commands
socket.on('moveJoystick', function (data) {
  moveArm(data.axes);
});