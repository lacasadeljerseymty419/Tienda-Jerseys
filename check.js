var fs = new ActiveXObject('Scripting.FileSystemObject');
var file = fs.OpenTextFile('c:/Users/Admin/.gemini/antigravity/scratch/jersey-store/js/app.js', 1);
var content = file.ReadAll();
file.Close();
try {
    var fn = new Function(content);
    WScript.Echo('Syntax OK');
} catch(e) {
    WScript.Echo('Syntax Error: ' + e.message);
}
