// Connect socket
var socket = io.connect(window.location.hostname);

// Connect to ROS
var ros = new ROSLIB.Ros();

ros.on('error', function(error) {
  console.log(error);
});

ros.on('connection', function() {
  console.log('Connection made!');
});

// Create a connection to rosbridge 
ros.connect('ws://localhost:9090');

// Configure the joystick topic
var joystick = new ROSLIB.Topic({
  ros: ros,
  name: '/joy',
  messageType: 'sensor_msgs/Joy'
});

var recordingActive = false;
var playbackActive = false;
var movements = null;
var stashedMovements = null;
var stashedLastStep = null;
var lastStepPerformed = 0;
var sampleRate = 10; // ms
var lastMessage = null;
var homeMovement = []; // path to go home

function setArmAutoExecution() {
  if (playbackActive) {
    // TODO: Make arm NOT auto execute movements
  } else {
    // TODO: Make arm execute movements
  }
}

function arraysEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length != b.length) return false;

  for (var i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// Generates home movement
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
  for (var i=0; i<50; i++) {
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

// Send movement to server
function logMovement(data) {
  // console.log('Logging arm at ' + data.axes + ' - ' + data.buttons);
  socket.emit('movement', { axes: data.axes, buttons: data.buttons });
}

// Subscribe to joystick movements
joystick.subscribe(function(data) {
  if (recordingActive || (lastStepPerformed > 0)) {
    lastMessage = data;
  }
});

// Update movements every 10 ms
function updateMovements() {
  if (recordingActive || (lastStepPerformed > 0)) {
    if (lastMessage != null) {
      logMovement(lastMessage);
    }
  }

  setTimeout(updateMovements, sampleRate);
}

// Start update loop
updateMovements();

// Move arm to a position
function moveArm(axes, buttons) {
  if ((playbackActive == true) || (arraysEqual(axes,[0,0,0]) && arraysEqual(buttons,[0,0]))) {
    //console.log('Moving arm to ' + axes + ' - ' + buttons);

    var message = new ROSLIB.Message({
      axes: axes,
      buttons: buttons
    });

    joystick.publish(message);
  } else {
    console.log("Cancelled movement");
  }
}

// Begin movement playback
function playbackMovement(step) {
  setArmAutoExecution();

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
    lastStepPerformed = 0;
    moveArm([0,0,0], [0,0]);

    if (stashedMovements.length > 0) {
      movements = stashedMovements;
      lastStepPerformed = stashedLastStep;
      
      stashedMovements = [];
      stashedLastStep = 0;
    }

    if (arraysEqual(movements, homeMovement)) {
      playbackActive = false;
      socket.emit('movedHome');
      movements = [];
    }
  }
}

socket.on('recordingStarted', function (data) {
  playbackActive = false;
  recordingActive = true;
  lastStepPerformed = 0;
  setArmAutoExecution()
});

socket.on('recordingEnded', function (data) {
  recordingActive = false;
  lastMessage = null;
});

socket.on('playbackStarted', function (data) {
  playbackActive = true;
  lastStepPerformed = 0;
  var newMovements = homeMovement.concat(data.movements);
  
  if (arraysEqual(movements, newMovements)) {
    playbackMovement(lastStepPerformed + 1);
  } else {
    movements = newMovements;
    playbackMovement();
  }

  setArmAutoExecution()
});

socket.on('playbackPaused', function (data) {
  playbackActive = false;
  moveArm([0,0,0], [0,0]);
  setArmAutoExecution();
});

socket.on('moveToHomePosition', function (data) {
  playbackActive = true;
  movements = homeMovement;
  playbackMovement();
});

socket.on('activateCartesian', function (data) {
  playbackActive = false;
  setArmAutoExecution();
  
  stashedMovements = movements;
  stashedLastStep = lastStepPerformed;
  movements = [];

  for (var i=0; i<50; i++) {
    movements.push("[0,0,0,[1,0]]");
  }

  playbackMovement();
});

socket.on('activateGripper', function (data) {
  playbackActive = false;
  setArmAutoExecution();
  
  stashedMovements = movements;
  stashedLastStep = lastStepPerformed;
  movements = [];

  for (var i=0; i<50; i++) {
    movements.push("[0,0,0,[1,1]]");
  }

  playbackMovement();
});

socket.on('activateWrist', function (data) {
  playbackActive = false;
  setArmAutoExecution();
  
  stashedMovements = movements;
  stashedLastStep = lastStepPerformed;
  movements = [];

  for (var i=0; i<50; i++) {
    movements.push("[0,0,0,[0,1]]");
  }

  playbackMovement();
});

generateHomeMovement();