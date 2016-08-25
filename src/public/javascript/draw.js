//INIT THE CANVAS
var canvas = document.getElementById("drawingCanvas");
var context = canvas.getContext("2d");

//Color Constructor
//ARGS
// name (string) - The name of the color
// hex (string) - The hexadecimal code of the color
function color(name, hex){
    this.name = name || "color";
    this.hex = hex || "#FFF";
}

//Init colors
var black = new color("Black","#000"), red = new color("Red","#FF0000"), green = new color("Green","#00FF00"), blue = new color("Blue","#0000FF");
var currentColor = black;

//Line width
var currentWeight = 1;

//mouse object for all mouse variables
var mouse = {
    currentX : 0,
    currentY : 0,
    lastX : 0,
    lastY : 0,
    down : false,
    right : false
};

var groupNum;

//Messages from the group
var messages;

//Max characters in a message
const MAX_CHARS = 140;  //Be sure to change on server end too if you wish to change

//When the mouse is pressed on the canvas
$("#drawingCanvas").on("mousemove",function(e){
    mouse.currentX = e.offsetX;
    mouse.currentY = e.offsetY;
    if(mouse.down){
        drawLine(mouse.lastX,mouse.lastY,mouse.currentX,mouse.currentY,currentColor.hex,currentWeight,mouse.right,true);
    }
    mouse.lastX = e.offsetX;
    mouse.lastY = e.offsetY;
});

//mouse down on canvas
$("#drawingCanvas").on("mousedown",function(e){
    mouse.down = true;
    mouse.right = e.button == 2 ? true : false;
    e.preventDefault();
});

//mouse up anywhere
$(document).on("mouseup",function(e){
    mouse.down = false;
    mouse.right = false;
});

//Returns distance between two points
function dist(startX,startY,endX,endY){
    return Math.sqrt(Math.pow((endX-startX),2) + Math.pow((endY-startY),2));
}

//converts a base 16 number to a base 10 number and returns the result
function base16To10(base16Num){
    var conversions = [['A','10'],['B','11'],['C','12'],['D','13'],['E','14'],['F','15']];
    //convert to string
    base16Num+="";
    base16Num = base16Num.split('');
    // converts letter from base 16 to number in base 10
    function letterToNum(potentialLet){
        for(var n = 0; n < conversions.length; n++){
            if(potentialLet == conversions[n][0] || potentialLet == conversions[n][0].toLowerCase()){
                return conversions[n][1];
            }
        }
        return potentialLet;
    }
    var total = 0;
    var index = 0;
    for(var i = base16Num.length-1; i >= 0; i --){
        base16Num[i] = letterToNum(base16Num[i]);
        total+= ((base16Num[i]*1)*(Math.pow(16,index)));
        index++;
    }
    return total;
}

//return an rgba value from a hex with extra values
function convertAlphaColor(color){
    if(color.length == 6){
        //convert abbreviated hexes to normal hexes
        color = "#"+color[1]+color[1]+color[2]+color[2]+color[3]+color[3];
    }
    return 'rgba('+base16To10(color[1]+color[2])+','+base16To10(color[3]+color[4])+','+base16To10(color[5]+color[6])+','+(base16To10(color[7]+color[8])/255)+')';
    
}

//draws a line
function drawLine(startX,startY,endX,endY,color,weight,erase,original){
    var origColor = color;
    if(color==undefined){
        color = black.hex;
    }
    if(weight==undefined){
        weight = 1;
    }
    if(erase==true){
        context.globalCompositeOperation = 'destination-out';
    } else {
        context.globalCompositeOperation = 'source-over';
    }
    if(color.length>7||color.length==6){
        color = convertAlphaColor(color);
    }
    //make lines for weight under three, circles of anything bigger
    if(weight<=2){
        context.lineWidth = weight;
        context.beginPath();
        context.strokeStyle = color;
        context.moveTo(startX,startY);
        context.lineTo(endX,endY);
        context.stroke();
    } else {
        var amt = dist(startX,startY,endX,endY)/0.1;
        //if the color is transparent, replace it with a shadow
        if(color[0] == 'r'){
            context.shadowOffsetX = 10000;
            context.shadowOffsetY = 10000;
            context.shadowBlur = 20;
            context.shadowColor = color;
        } else {
            context.shadowOffsetX = 0;
            context.shadowOffsetY = 0;
            context.shadowBlur = 0;
            context.shadowColor = color;
        }
        context.beginPath();
        context.fillStyle = color;
        //draw a circle every 0.1 pixels at the desired size
        for(var i = 0; i < amt; i+=1){
            context.arc((startX+(i*((endX-startX)/amt)))-context.shadowOffsetX,(startY+(i*((endY-startY)/amt)))-context.shadowOffsetY,weight/2,0,2*Math.PI);
        }
        context.fill();
    }
    if(original==true){
        socket.emit('drawLine',{sX:startX,sY:startY,eX:endX,eY:endY,col:origColor,wid:weight,era:erase,ori:false});
    }
}

//attempt to join a group
function sendGroupRequest(groupID){
    socket.emit('reqGroup',groupID);
}

//attempt to create a group
function createGroup(){
    socket.emit('createGroup',true);
}

//Download the current drawing
function download(name){
    var dataUrl = canvas.toDataURL();
    //THANKS @Nippey from this question on stack overflow: http://stackoverflow.com/questions/2793751/how-can-i-create-download-link-in-html
    /* Change MIME type to trick the browser to downlaod the file instead of displaying it */
    dataUrl = dataUrl.replace(/^data:image\/[^;]*/, 'data:application/octet-stream');
    /* In addition to <a>'s "download" attribute, you can define HTTP-style headers */
    dataUrl = dataUrl.replace(/^data:application\/octet-stream/, 'data:application/octet-stream;headers=Content-Disposition%3A%20attachment%3B%20filename="mySketch.png"');
    var link = document.getElementById('downloadLink');
    link.href = dataUrl;
    if(name!=undefined||name==""){
        link.download = name+".png";
    }
    link.click();
    link.download = "mySketch.png";
}

function sendMsg(msg){
    if(msg.length>MAX_CHARS){
        //TODO: Make a better notification!!!
        alert('Error: Message length longer than limit of ' + MAX_CHARS + ' characters, sorry about that!');
    } else {
        socket.emit('sendMsg',msg);
    }
}

////////////////////////////////////////////////////////////////////////////////
//
//                          WEB SOCKET RECIEVING HANDLING
//
////////////////////////////////////////////////////////////////////////////////

//Tell the new group leader that they have the role
socket.on('newLeader',function(data){
   //TODO: Make a better notification!!!
   alert('You are the new leader of this group!');
});

//other group member drew line
socket.on('drawLine',function(data){
    drawLine(data.sX,data.sY,data.eX,data.eY,data.col,data.wid,data.era);
});

//Someone is requesting to join the group
socket.on('reqGroup',function(id){
    //TODO: MAKE A BETTER NOTIFICATION!!!
    if(confirm("Someone wishes to join this group")){
        socket.emit('accGroup',id);
    } else {
        socket.emit('decGroup',id);
    }
});

//alert user that they joined the group
socket.on('accGroup',function(id){
    //TODO: MAKE A BETTER NOTIFICATION!!!
    alert('You are in group ' + id + '!');
    groupNum = id;
    socket.emit('confirmGroup',id);
    socket.emit('reqCanvas',true);
    socket.emit('getMessages',true);
});

//alert user that they were declines access
socket.on('decGroup',function(id){
    //TODO: MAKE A BETTER NOTIFICATION!!!
    alert('Sorry, unfortunately, you were declined access to the group');
})

//Notify user of error of some sort
socket.on('err',function(reason){
    //TODO: MAKE A BETTER NOTIFICATION!!!
    alert("Error: "+reason);
});

//Another user wants the current canvas design
socket.on('reqCanvas',function(userID){
    var dataUrl = canvas.toDataURL();
    socket.emit('sendCanvas',{user:userID,dataURL:dataUrl});
});

//Get the canvas
socket.on('recieveCanvas',function(dataURL){
   var img = document.getElementById('groupCanvas');
   img.src = dataURL;
   context.drawImage(img,0,0);
});

//Requested group messages
socket.on('recieveMessages',function(msgs){
    messages = msgs;
});

//Got a new message
socket.on('recieveMsg',function(msg){
    //if the messages have all been recieved add the message
    if(messages!=undefined){
        messages.push(msg);
    } else {
        //otherwise check every .1 seconds until the other messages have loaded, then add message
        var check = setInterval(function(){
            if(messages!=undefined){
                messages.push(msg);
                clearInterval(check);
            }
        }, 100);
    }
});