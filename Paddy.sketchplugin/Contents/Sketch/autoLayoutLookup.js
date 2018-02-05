

var alCommand = autoLayoutCommand()

function autoLayoutCommand() {

  var pluginsURLs = MSPluginManager.pluginsURLs()
  if (pluginsURLs.length < 1) return

  var baseURL = pluginsURLs[0] // Should link to 'file:///Users/{username}/Library/Application%20Support/com.bohemiancoding.sketch3/Plugins/'
  var autoLayoutURL = baseURL.URLByAppendingPathComponent('AutoLayoutPlugin.sketchplugin')
  if (!autoLayoutURL) return

  var autoLayoutPlugin = MSPluginBundle.pluginBundleWithURL(autoLayoutURL)
  if (!autoLayoutPlugin) return

  var commands = autoLayoutPlugin.commands()
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
