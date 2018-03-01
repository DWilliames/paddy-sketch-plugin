
function loadFramework(name, className) {
  if (NSClassFromString(className) == null) {
    var path = plugin.urlForResourceNamed(name + ".framework").path().stringByDeletingLastPathComponent()
    return Mocha.sharedRuntime().loadFrameworkWithName_inDirectory(name, path)
  }
  return true
}



loadFramework("SketchAsync", "DWSketchAsync")

function runInBackground(block) {
  var target = COSTarget.targetWithJSFunction(block)
  DWSketchAsync.runInBackground(target)
}

function runOnMain(block) {
  var target = COSTarget.targetWithJSFunction(block)
  DWSketchAsync.runInBackground(target)
}
