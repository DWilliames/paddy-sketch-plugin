@import 'main.js'
@import 'utils.js'

function updateForSymbolInstance(symbol) {
  if (!symbol || !symbol.isMemberOfClass(MSSymbolInstance)) return

  log(1, 'Update for symbol instance...', symbol)

  var master = symbol.symbolMaster()
  var symbolOverrides = getStringOverridesForSymbolInstance(symbol)

  if (Object.keys(symbolOverrides).length == 0) {
    return
  }

  var originalProperties = {}
  var originalPositions = {}
  var bg = backgroundLayerForSymbol(symbol)

  if (!bg || !master || !master.children()) return

  log(3, 'Override symbol master with...', JSON.stringify(symbolOverrides))

  var padding = getPaddingFromLayer(bg)

  // Remember the current sizes
  var masterFrame = master.frame()
  var originalSymbolWidth = symbol.frame().width()
  var originalBackgroundFrame = bg.frame()
  var originalWidth = bg.frame().width()
  var originalHeight = bg.frame().height()
  var additionalWidth = masterFrame.width() - originalBackgroundFrame.width()
  var additionalHeight = masterFrame.height() - originalBackgroundFrame.height()

  var maxTextWidth = null
  if (padding.conditions && padding.conditions.maxWidth) {
    maxTextWidth = padding.conditions.maxWidth - padding.left - padding.right
  }

  var ignoreWidth = (padding.left == 'x' && padding.right == 'x')

  // Get all the layers to override, sorted from left to right on the screen
  var layersToOverride = filter(master.children(), function(layer) {
    return symbolOverrides[layer.objectID()]
  }).sort(function(a, b) {
    return a.absoluteRect().origin().x <= b.absoluteRect().origin().x ? -1 : 1
  })

  var dependentObjects = []
  layersToOverride.forEach(function(layer) {
    if (!doesArrayContainSibling(dependentObjects, layer)) {
      dependentObjects.push(layer)
    }
  })

  var dependentObjectIDs = dependentObjects.map(function(layer) {
    return layer.objectID()
  })

  var dependents = {}

  layersToOverride.forEach(function(layer) {
    if (!containsLayerID(dependentObjectIDs, layer.objectID()))
      return

    var dependentLayers = dependentLayersOfLayerIgnoringLayers(layer, dependentObjectIDs)
    if (dependentLayers) {
      dependents[layer.objectID()] = {
        dependents: dependentLayers.dependents,
        layer: layer.name()
      }
      dependentObjectIDs = dependentLayers.objectIDsToIgnore
    }
  })


  // In case the text is 'right aligned'
  var maxWidthTextLayer = {
    width: 0,
    layer: null
  }


  // Let's remember the background position/size
  originalProperties[bg.objectID()] = {
    width: bg.frame().width(),
    height: bg.frame().height()
  }

  originalPositions[bg.objectID()] = {
    x: bg.frame().x(),
    y: bg.frame().y()
  }


  // Let's find out all the dependent layers
  // That is, after changing the string value of a label; it moves other layers next to it

  // Loop over every possible override
  // Change the text value, to the override value
  // If the text alignment is 'fixed' temporarily set it to 'auto'
  layersToOverride.forEach(function(layer) {
    var id = layer.objectID()

    // If the text layer is 'fixed', pin it to the right 'and' left, if it does have a fixed width
    if (layer.isMemberOfClass(MSTextLayer) && layer.textBehaviour() == 1 && !layer.hasFixedWidth()) {
      layer.hasFixedRight = true
      layer.hasFixedLeft = true
    } else if (layer.textAlignment() == 2) {
      layer.hasFixedLeft = true
      layer.hasFixedRight = true
    } else if (!(layer.hasFixedLeft() || layer.hasFixedRight())) {
      if (layer.textAlignment() == 1) {
        layer.hasFixedRight = true
      } else {
        layer.hasFixedLeft = true
      }
    }
    if (!(layer.hasFixedTop() || layer.hasFixedBottom())) {
      layer.hasFixedTop = true
    }

    // Text behaviour is same as alignment
    // 0: Auto alignment
    // 1: Fixed alignment
    originalProperties[id] = {
      behaviour: layer.textBehaviour(),
      width: layer.frame().width(),
      height: layer.frame().height(),
      stringValue: layer.stringValue()
    }

    if (!originalPositions[id]) {
      originalPositions[id] = {
        x: layer.frame().x(),
        y: layer.frame().y()
      }
    }


    var parent = layer.parentGroup()
    if (parent.isMemberOfClass(MSLayerGroup)) {
      originalPositions[parent.objectID()] = {
        x: parent.frame().x(),
        y: parent.frame().y()
      }
    }

    if (layer.frame().width() >= maxWidthTextLayer.width) {
      maxWidthTextLayer.width = layer.frame().width()
      maxWidthTextLayer.layer = layer
    }


    layer.stringValue = symbolOverrides[id]
    // if (ignoreWidth) {
      layer.textBehaviour = 0
    // }

    layer.adjustFrameToFit()

    if ((maxTextWidth && layer.frame().width() > maxTextWidth) || ignoreWidth) {

      // Make sure the text is a single line – we're trying to get the size of the height
      var newStringValue = layer.stringValue()
      layer.stringValue = 'Ay' // We want a rough height, including ascenders and descenders

      // There's a tiny offset we need to calculate, to make it look 'just right'
      var originalGlyphBounds = layer.glyphBounds()
      var yOffset = layer.frame().height() - (originalGlyphBounds.size.height + originalGlyphBounds.origin.y)

      layer.stringValue = newStringValue

      layer.textBehaviour = 1

      if (layer.hasFixedWidth()) {
        layer.width = originalProperties[id].width
      } else if (layer.parentGroup() && layer.parentGroup().hasFixedWidth()) {

        var layerMaxWidth = layer.parentGroup().frame().width() - originalPositions[id].x
        if (layer.frame().width() > layerMaxWidth) {
          layer.frame().width = layerMaxWidth
        }

      } else if (ignoreWidth) {
        var originalLayerWidth = originalProperties[id].width
        var widthDiff = masterFrame.width() - originalLayerWidth

        layer.frame().width = symbol.frame().width() - widthDiff
      } else {
        layer.frame().width = maxTextWidth
      }

      layer.adjustFrameToFit()

      var glyphBounds = layer.glyphBounds()
      var height = glyphBounds.size.height + glyphBounds.origin.y + yOffset
      layer.frame().height = height
    }

    if (!dependents[id]) return

    var dependentLayers = dependents[id].dependents

    while(dependentLayers.length > 0) {
      var newDependentLayers = []

      dependentLayers.forEach(function(dependent) {

        var dependentLayer = layer.parentGroup().layerWithID(dependent.objectID)
        var supporter = layer.parentGroup().layerWithID(dependent.supporter)

        if (dependentLayer && supporter) {

          dependentLayer.hasFixedWidth = true
          if (!originalPositions[dependentLayer.objectID()]) {
            originalPositions[dependentLayer.objectID()] = {
              x: dependentLayer.frame().x(),
              y: dependentLayer.frame().y()
            }

            var parent = dependentLayer.parentGroup()
            if (parent.isMemberOfClass(MSLayerGroup)) {
              originalPositions[parent.objectID()] = {
                x: parent.frame().x(),
                y: parent.frame().y()
              }
            }
          }

          var offset = dependent.xDiff

          if (offset < 0) {
            dependentLayer.frame().x = supporter.frame().x() + offset - dependentLayer.frame().width()
          } else {
            dependentLayer.frame().x = supporter.frame().maxX() + offset
          }
        }

        if (dependent.dependents) {
          dependent.dependents.forEach(function(dependent) {
            newDependentLayers.push(dependent)
          })
        }

      })

      dependentLayers = newDependentLayers
    }

  })


  log(3, 'Original properties...', JSON.stringify(originalProperties))

  // Get the text value from the symbol
  var newPositions = {}

  fixEdges(bg)

  takeIntoAccountStackViews = true

  updatePaddingForLayerBG(bg)

  var newSize = bg.frame()
  var newWidth = newSize.width() + additionalWidth
  if (newWidth < 0) {
    newWidth = -newWidth
  }

  var newHeight = newSize.height() + additionalHeight
  if (newHeight < 0) {
    newHeight = -newHeight
  }

  if (!ignoreWidth) {
    symbol.frame().setWidth(newWidth)
  }

  if (!(padding.top == 'x' && padding.bottom == 'x')) {
    symbol.frame().setHeight(newHeight)
  }

  log(2, 'Got new size from master', newSize)
  log(3, 'Resetting overrides on master')

  // Reset all the values and positions
  Object.keys(originalProperties).forEach(function(id) {
    var layer = master.layerWithID(id)

    layer.frame().width = originalProperties[id].width
    layer.frame().height = originalProperties[id].height

    if (layer.isMemberOfClass(MSTextLayer)) {
      layer.stringValue = originalProperties[id].stringValue
      layer.textBehaviour = originalProperties[id].behaviour
    }
  })

  Object.keys(originalPositions).forEach(function(id) {
    var layer = master.layerWithID(id)

    layer.frame().setX(originalPositions[id].x)
    layer.frame().setY(originalPositions[id].y)
  })

  takeIntoAccountStackViews = false

  updatePaddingForLayerBG(bg)


  // If the max width text layer is right aligned – then resize the symbol from the right
  if (maxWidthTextLayer.layer && maxWidthTextLayer.layer.textAlignment() == 1) {
    var xDiff = originalSymbolWidth - symbol.frame().width()
    symbol.frame().setX(symbol.frame().x() + xDiff)
  }

  resizeLayer(symbol)
}


/**
 * Fix all the edges of the given layer
 */
function fixEdges(layer) {
  layer.hasFixedLeft = true
  layer.hasFixedTop = true
  layer.hasFixedRight = true
  layer.hasFixedBottom = true
}


function getStringOverridesForSymbolInstance(symbol) {
  log(2, 'Getting string overrides for symbol instance', symbol)

  var overrides = {}

  var availableOverrides = symbol.availableOverrides()
  if (!availableOverrides) return overrides

  availableOverrides.forEach(function(availableOverride) {
    var overrideValue = availableOverride.overrideValue()
    log(2, 'getting override for', overrideValue)

    if (availableOverride.overridePoint().property() == 'stringValue') {
      if (!overrideValue) {
        overrideValue = availableOverride.defaultValue()
      }

      if (overrideValue) {
        var value = (overrideValue.isMemberOfClass(MSOverrideValue)) ? overrideValue.value() : overrideValue
        var key = availableOverride.overridePoint().layerID()
        overrides[key] = value
      }
    }
  })

  log(2, 'Overrides:', JSON.stringify(overrides))

  return overrides
}


function backgroundLayerForSymbol(symbol) {
  log(2, 'Getting background layer for symbol', symbol)

  var master = symbol.isMemberOfClass(MSSymbolMaster) ? symbol : symbol.symbolMaster()

  // var bg = null

  // var symbolOverrides = getStringOverridesForSymbolInstance(symbol)

  // master.children().find(function(layer) {
  //   if (layerHasPadding(possibleBG)) {
  //
  //   }
  //   // if (symbolOverrides[layer.objectID()]) {
  //   if (layer.isMemberOfClass(MSTextLayer)) {
  //     var possibleBG = getBackgroundForLayer(layer)
  //     if (layerHasPadding(possibleBG)) {
  //       bg = possibleBG
  //       return true
  //     }
  //   }
  //   return false
  // })
  //
  var bg = master.children().find(function(layer) {
    return layerHasPadding(layer)
  })

  log(2, 'Found background', bg)

  return bg
}
