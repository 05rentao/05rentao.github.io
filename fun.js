var Image = require('ascii-art-image');

var image = new Image({
    filepath: '~/Images/metropolis.jpg',
    alphabet:'variant4'
});

image.write(function(err, rendered){
    console.log(rendered);
})