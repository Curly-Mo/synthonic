function $(id) {
    return document.getElementById(id);
}

document.addEventListener("DOMContentLoaded", function() {
    output.connect(graph_in);

    if (navigator.userAgent.indexOf('Safari') <= -1 && navigator.userAgent.indexOf('Chrome') <= -1){
        alert('Warning: This browser might not be supported. If you experience poor performance try Chrome or Safari. (Runs best in Chrome)')
    }
}, false);
