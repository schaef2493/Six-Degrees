var up_pressed = false;
var down_pressed = false;
var left_pressed = false;
var right_pressed = false;

var connection = new ros.Connection("ws://hostname:9090");

connection.setOnClose(function (e) {
  console.log('connection closed');
});

connection.setOnError(function (e) {
  console.log('error!');
});

connection.setOnOpen(function (e) {
  console.log('connected to ROS');
});

function print_instruction(pressed,dir,v) {
  movement_vector = '';

  // TODO: This allows us to send an empty movement vector
  // TODO: Figure out how these vectors map to the arm movement

  if (dir == 'up') {
      movement_vector = '{"linear":{"x":1.0,"y":0.0,"z":0}, "angular":{"x":0.0,"y":0.0,"z":0.0}}';
  } 
  else if (dir == 'down') {

  } 
  else if (dir == 'left') {

  }
  else if (dir == 'right') {

  }

  if (pressed) {
    console.log("stop " + dir);
    movement_vector = '{"linear":{"x":0.0,"y":0.0,"z":0}, "angular":{"x":0.0,"y":0.0,"z":0.0}}';
  }
  else {
    console.log("start " + dir + " " + v);
  }

  console.log('movement: ' + movement_vector);
  connection.publish('/cmd_vel', 'geometry_msgs/Twist', movement_vector);
}

$(document).ready(function() {

  $('#up').click(function() {
  	print_instruction(up_pressed,"up",1);
    up_pressed = !up_pressed;
  });

  $('#down').click(function() {
  	print_instruction(down_pressed,"down",1);
    down_pressed = !down_pressed;
  });

  $('#left').click(function() {
  	print_instruction(left_pressed,"left",1);
    left_pressed = !left_pressed;
  });

  $('#right').click(function() {
  	print_instruction(right_pressed,"right",1);
    right_pressed = !right_pressed;
  });

});
