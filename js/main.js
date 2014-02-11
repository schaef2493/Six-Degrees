// State tracking
var up_pressed = false;
var down_pressed = false;
var left_pressed = false;
var right_pressed = false;


// Connecting to ROS
var ros = new ROSLIB.Ros();

// If there is an error on the backend, an 'error' emit will be emitted.
ros.on('error', function(error) {
  console.log(error);
});

// Find out exactly when we made a connection.
ros.on('connection', function() {
  console.log('Connection made!');
});

// Create a connection to the rosbridge WebSocket server.
ros.connect('ws://localhost:9090');

// Configure the twist topic
var cmdVel = new ROSLIB.Topic({
  ros : ros,
  name : '/cmd_vel',
  messageType : 'geometry_msgs/Twist'
});

function print_instruction(pressed,dir,v) {
  var message = null;

  // TODO: This allows us to send an empty movement vector
  // TODO: Figure out how these vectors map to the arm movement
  // (-0.5, 0.5) is the range of input

  if (dir == 'up') {
      message = new ROSLIB.Message({
        linear : {
          x : 0.5,
          y : 0.0,
          z : 0.0
        },
        angular : {
          x : 0.0,
          y : 0.0,
          z : 0.0
        }
      });
  } 
  else if (dir == 'down') {

  } 
  else if (dir == 'left') {

  }
  else if (dir == 'right') {

  }

  if (pressed) {
    console.log("stop " + dir);
    message = new ROSLIB.Message({
        linear : {
          x : 0.0,
          y : 0.0,
          z : 0.0
        },
        angular : {
          x : 0.0,
          y : 0.0,
          z : 0.0
        }
      });
  }
  else {
    console.log("start " + dir + " " + v);
  }

  cmdVel.publish(message);
}

$(document).ready(function() {

  $('#up').click(function() {
  	print_instruction(up_pressed,"up",0.5);
    up_pressed = !up_pressed;
  });

  $('#down').click(function() {
  	print_instruction(down_pressed,"down",0.5);
    down_pressed = !down_pressed;
  });

  $('#left').click(function() {
  	print_instruction(left_pressed,"left",0.5);
    left_pressed = !left_pressed;
  });

  $('#right').click(function() {
  	print_instruction(right_pressed,"right",0.5);
    right_pressed = !right_pressed;
  });

});
