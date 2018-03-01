
// Whether to show logging or not
var DEBUG = false // FALSE for prod
var TIMER = false // FALSE for prod
var PERSISTENT = true // TRUE for prod

/**
 * Log a bunch of values
 * Pass in a number first, to indicate how many levels deep it should print
 */
function log() {
  if (!DEBUG || arguments.length == 0) return

  var args = Object.values(arguments)

  var indent = '∙'
  var prefix = ''
  if (Number.isInteger(args[0])) {
    prefix = Array(args[0] + 1).join(indent)
    args.shift()
  }
  args.forEach(function(arg, index){
    print(index > 0 ? prefix + '↳ ' + arg : prefix + arg)
  })
}


var timerTimestamp = null

/**
 * Helper method to measure the time it takes to perform a task
 */
function startBenchmark() {
  timerTimestamp = NSDate.date().timeIntervalSince1970()
}

function endBenchmark() {
  if (!timerTimestamp || !TIMER) return

  var now = NSDate.date().timeIntervalSince1970()
  var diff = (now - timerTimestamp) * 1000

  print('⏱ Time taken: ' + parseFloat(Math.round(diff * 100) / 100).toFixed(0) + 'ms')

  timerTimestamp = null
}


/**
 * Given an array and a condition, return the array by removing all elements
 * that do not meet the condition
 */
function filter(array, condition) {
  var emptyArray = []
  array.forEach(function(element) {
    if (condition(element))
      emptyArray.push(element)
  })

  return emptyArray
}


/**
 * Given a string an a regular expression
 * Return the first match, or null if there isn't any
 */
function firstRegexMatch(regex, string) {
  var matches = regex.exec(string)
  return (matches && matches.length > 1) ? matches[1] : null
}


/**
 * Return if the current application is before a specified version
 * e.g. '47.2'
 */
function isCurrentVersionBefore(version) {
  var appVersion = MSApplicationMetadata.metadata().appVersion
  return compareVersion(appVersion, version) < 0
}


function compareVersion(a, b) {
  var i, cmp, len, re = /(\.0)+[^\.]*$/
  a = (a + '').replace(re, '').split('.')
  b = (b + '').replace(re, '').split('.')
  len = Math.min(a.length, b.length)
  for(i = 0; i < len; i++) {
    cmp = parseInt(a[i], 10) - parseInt(b[i], 10)
    if(cmp !== 0) {
      return cmp
    }
  }
  return a.length - b.length
}


function contains(array, element) {
  return array.find(function(e) {
    return e == element
  })
}


function stringArraysEqual(a1, a2) {
  if (a1.length != a2.length) return false

  var s1 = a1.slice().sort().toString()
  var s2 = a2.slice().sort().toString()

  return (s1 == s2)
}


var previouslySelectedKey = 'previousSelectedProps'
var previousParentKey = 'previousParentProps'
var persistentLayersKey = 'persistentLayers'

var persistentData = {}


// Set / Get values from Doc

function getValueWithKeyFromDoc(key) {
  var docData = persistentData[document.hash()]
  if (!docData) {
    return
  }

  return docData[key]
}


function saveValueWithKeyToDoc(value, key) {
  var docData = persistentData[document.hash()]
  if (!docData) {
    docData = {}
  }

  docData[key] = value

  persistentData[document.hash()] = docData
}


// Set / Get values from layer

function saveValueWithKeyToLayer(value, key, layer) {
  var pluginIdentifier = plugin.identifier()
  command.setValue_forKey_onLayer_forPluginIdentifier(value, key, layer, pluginIdentifier)
}

function getValueForKeyFromLayer(key, layer) {
  var pluginIdentifier = plugin.identifier()
  return command.valueForKey_onLayer_forPluginIdentifier(key, layer, pluginIdentifier)
}


// User deafults

var defaults = NSUserDefaults.standardUserDefaults()

function saveValueWithKeyToDefaults(value, key) {
  defaults.setObject_forKey(value, key)
}

function getValueWithKeyFromDefaults(key) {
  return defaults.objectForKey(key)
}
