

var alCommand = autoLayoutCommand()

function autoLayoutCommand() {

  var pluginManager = AppController.sharedInstance().pluginManager()
  var plugin = pluginManager.plugins().objectForKey('com.animaapp.stc-sketch-plugin')

  if (!plugin) return
  var commands = plugin.commands()

  if (!commands) return

  return commands['autolayout']
}


function alTypeForLayer(layer) {
  var kViewTypeKey = "kViewTypeKey"

  if (!alCommand) return

  return alCommand.valueForKey_onLayer(kViewTypeKey, layer)
}


function alPropertiesForLayer(layer) {
  var kModelPropertiesKey = "kModelPropertiesKey"

  if (!alCommand) return

  return alCommand.valueForKey_onLayer(kModelPropertiesKey, layer)
}


function layerIsStackView(layer) {
  return alTypeForLayer(layer) == 'ADModelStackView'
}
