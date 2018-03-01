
function loadFramework(name, className) {
  if (NSClassFromString(className) == null) {
    var path = plugin.urlForResourceNamed(name + ".framework").path().stringByDeletingLastPathComponent()
    return Mocha.sharedRuntime().loadFrameworkWithName_inDirectory(name, path)
  }
  return true
}



loadFramework("SketchAsync", "SketchAsync")

function runInBackground(block) {
  var target = COSTarget.targetWithJSFunction(block)
  SketchAsync.alloc().init().runInBackground(target)
}
