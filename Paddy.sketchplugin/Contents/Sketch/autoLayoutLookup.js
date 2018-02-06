

var alCommand = autoLayoutCommand()

function commandsForPluginNames(pluginName) {

  var pluginsURLs = MSPluginManager.pluginsURLs()
  if (pluginsURLs.length < 1) return

  var baseURL = pluginsURLs[0] // Should link to 'file:///Users/{username}/Library/Application%20Support/com.bohemiancoding.sketch3/Plugins/'
  var pluginURL = baseURL.URLByAppendingPathComponent(pluginName + '.sketchplugin') // Maybe 'LaunchpadPlugin' instead?
  if (!pluginURL) return

  var plugin = MSPluginBundle.pluginBundleWithURL(pluginURL)
  if (!plugin) return

  var commands = plugin.commands()
}

function autoLayoutCommand() {

  var commands = commandsForPluginNames('AutoLayoutPlugin')
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
