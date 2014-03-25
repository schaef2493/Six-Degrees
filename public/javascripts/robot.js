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
var playbackActive = false;
var movements = null;
var lastStepPerformed = 0;
var sampleRate = 10; // ms
var lastMessage = null;

function sendMovement(data) {
  console.log('Recording arm at ' + data.axes);
  socket.emit('movement', { axes: data.axes });
}

joystick.subscribe(function(message) {
  if (recordingActive) {
    //sendMovement(message);
    lastMessage = message;
  }
});

function updateMovements() {
  if (recordingActive) {
    sendMovement(lastMessage);
  }

  setTimeout(updateMovements, sampleRate);
}

// Start update loop
updateMovements();

function moveArm(axes) {
  console.log((axes.header.stamp.secs*1000000000) + (axes.header.stamp.nsecs) + ' Moving arm to ' + axes);

  var message = new ROSLIB.Message({
    axes: axes,
    buttons: [0,0]
  });

  joystick.publish(message);
}

function playbackMovement(step) {
  if (typeof step == 'undefined') {
    step = 0;
  }

  // break if playback was paused
  if (playbackActive == false) {
    return;
  }

  var axes = JSON.parse(movements[step]);
  moveArm(axes);
  lastStepPerformed = step;

  if (step < movements.length-1) {
    setTimeout(playbackMovement, sampleRate, step+1);
  } else {
    lastStepPerformed = -1;
    moveArm([0,0,0]);
  }
}

socket.on('recordingStarted', function (data) {
  recordingActive = true;
});

socket.on('recordingEnded', function (data) {
  recordingActive = false;
});

socket.on('playbackStarted', function (data) {
  playbackActive = true;
  movements = data.movements;
  playbackMovement();
});

socket.on('playbackResumed', function (data) {
  playbackActive = true;
  playbackMovement(lastStepPerformed + 1);
});

socket.on('playbackPaused', function (data) {
  playbackActive = false;
  moveArm([0,0,0]);
});