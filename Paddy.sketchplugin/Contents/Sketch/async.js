// Work in progress

function loadFramework(name, className) {
  if (NSClassFromString(className) == null) {
    var path = plugin.urlForResourceNamed(name + ".framework").path().stringByDeletingLastPathComponent()
    return Mocha.sharedRuntime().loadFrameworkWithName_inDirectory(name, path)
  }
  return true
}

function runInBackground(block) {
  // var target = COSTarget.targetWithJSFunction(block)
  // DWSketchAsync.runOnBackgroundThread(target)
  block()
}

function runOnMainThread(block) {
  // var target = COSTarget.targetWithJSFunction(block)
  // DWSketchAsync.runOnMainThread(target)
  block()
}
