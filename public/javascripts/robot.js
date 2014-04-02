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
var homeMovement = []; // path to go home

function arraysEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length != b.length) return false;

  for (var i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function generateHomeMovement() {
  var homeCommand = "[0,0,0,[1,1]]";
  var homeMovementWait = "[0,0,0,[0,0]]";

  // Put into cartesian mode
  for (var i=0; i<50; i++) {
    homeMovement.push("[0,0,0,[1,0]]");
  }

  // Move to home
  for (var i=0; i<300; i++) {
    homeMovement.push(homeCommand);
  }

  // Wait
  for (var i=0; i<150; i++) {
    homeMovement.push(homeMovementWait);
  }

  // Put into gripper mode
  for (var i=0; i<50; i++) {
    homeMovement.push("[0,0,0,[1,1]]");
  }

  // Open gripper
  for (var i=0; i<200; i++) {
    homeMovement.push("[-1,0,0,[0,0]]");
  }

  // Put into cartesian mode
  for (var i=0; i<50; i++) {
    homeMovement.push("[0,0,0,[1,0]]");
  }

}

function sendMovement(data) {
  //console.log('Recording arm at ' + data.axes + ' - ' + data.buttons);
  socket.emit('movement', { axes: data.axes, buttons: data.buttons });
}

joystick.subscribe(function(data) {
  if (recordingActive) {
    lastMessage = data;
  }
});

function updateMovements() {
  if (recordingActive) {
    if (lastMessage != null) {
      sendMovement(lastMessage);
    }
  }

  setTimeout(updateMovements, sampleRate);
}

// Start update loop
updateMovements();

function moveArm(axes, buttons) {
  if ((playbackActive == true) || (arraysEqual(axes,[0,0,0]) && arraysEqual(buttons,[0,0]))) {
    //console.log('Moving arm to ' + axes + ' - ' + buttons);

    var message = new ROSLIB.Message({
      axes: axes,
      buttons: buttons
    });

    joystick.publish(message);
  }
}

function playbackMovement(step) {
  if (typeof step == 'undefined') {
    step = 0;
  }

  // break if playback was paused
  if (playbackActive == false) {
    moveArm([0,0,0], [0,0]);
    return;
  }

  var axes = (JSON.parse(movements[step])).slice(0,3);
  var buttons = JSON.parse(movements[step])[3];
  moveArm(axes, buttons);
  lastStepPerformed = step;

  if (step < movements.length-1) {
    setTimeout(playbackMovement, sampleRate, step+1);
  } else {
    lastStepPerformed = -1;
    moveArm([0,0,0], [0,0]);

    if (arraysEqual(movements, homeMovement)) {
      playbackActive = false;
      socket.emit('movedHome');
      movements = [];
    } else {
      socket.emit('playbackEnded');
    }
  }
}

socket.on('recordingStarted', function (data) {
  recordingActive = true;
});

socket.on('recordingEnded', function (data) {
  recordingActive = false;
  lastMessage = null;
});

socket.on('playbackStarted', function (data) {
  playbackActive = true;
  movements = homeMovement.concat(data.movements);
  playbackMovement();
});

socket.on('playbackResumed', function (data) {
  playbackActive = true;
  playbackMovement(lastStepPerformed + 1);
});

socket.on('playbackPaused', function (data) {
  playbackActive = false;
  moveArm([0,0,0], [0,0]);
});

socket.on('moveToHomePosition', function (data) {
  playbackActive = true;
  movements = homeMovement;
  playbackMovement();
});

generateHomeMovement();