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

var recordingActive = false;
var recordLog = [];
var playbackLog = [];

function sendMovement(data) {
  recordLog.push(data.axes.push((new Date).getTime()));
  socket.emit('movement', { axes: data.axes, header: data.header });
}

var sendMovementThrottled = _.throttle(sendMovement, 10);

joystick.subscribe(function(message) {
  if (recordingActive) {
    sendMovementThrottled(message);
  }
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
  playbackLog.push(data.axes.push((new Date).getTime()));
  moveArm(data.axes);
});

socket.on('recordingStarted', function (data) {
  recordingActive = true;
});

socket.on('recordingEnded', function (data) {
  recordingActive = false;
});