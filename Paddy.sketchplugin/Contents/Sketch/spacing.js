@import 'utils.js'

/*
Example spacing object:

{
  vertical: 10,
  horizontal: 20
}

[left]
[c]
[10v]
[10v left]
[l]

*/


// ****************************
//   Spacing from/to layer name
// ****************************


/**
 * Return if a layer can have spacing associated with it
 */
function canLayerHaveSpacing(layer) {
  if (!layer) return false
  return layer.isMemberOfClass(MSLayerGroup) || layer.isMemberOfClass(MSArtboardGroup) || layer.isMemberOfClass(MSPage)
}

/**
 * Get padding from a layer's name
 * Returned as a Spacing object
 */
function getSpacingFromLayer(layer) {
  var spacingString = layerSpacingString(layer)
  return spacingFromString(spacingString)
}


/**
 * Given a spacing object, save it to a layer in it's name
 * Preserving the layers current name
 */
function saveSpacingToLayer(spacing, layer) {
  log(2, 'Saving spacing to layer', layer, JSON.stringify(spacing))
  var name = layer.name().split('[')[0]

  if (!spacing) {
    layer.name = name
    return
  }

  if (name.slice(-1) != ' ')
    name += ' '

  layer.name = name + '[' + spacingToString(spacing) + ']'
}


/**
 * Return if a layer already has spacing associated
 */
function layerHasSpacing(layer) {
  return canLayerHaveSpacing(layer) && layerSpacingString(layer) != null
}


/**
 * Return the raw padding value
 * The string between '[' and ']'
 */
function layerSpacingString(layer) {
  if (!layer) return

  var regex = /\[(.*)\]/g
  return firstRegexMatch(regex, layer.name())
}



// ****************************
//   Spacing data transformations
// ****************************

var spacingValuesSplitter = ' ' // The string to split values, e.g. ';' or ':'


/**
 * Given a spacing object
 * Convert it to a string
 */
function spacingToString(spacing) {

  var spacingString = ''

  if (spacing.space && spacing.layout) {
    spacingString += (spacing.space + spacing.layout)
  }

  if (spacing.align) {
    if (spacingString != '') {
      spacingString += ' '
    }

    spacingString += spacing.align
  }

  return spacingString

}


/**
 * Given a string e.g. 'vert 20'
 * Convert it to a spacing object
 */
function spacingFromString(string) {
  if (!string || string == '')
    return null

  var values = string.split(' ')

  // Possibly alignment first...
  var alignment = simplifyAlignment(values[0])
  if (alignment) {
    return spacing = {
      align: alignment
    }
  }

  var spacingLayout = values[0]

  var layout = spacingLayout.slice(-1)
  if (!(layout == 'v' || layout == 'h')) {
    return
  }

  var space = spacingLayout.substring(0, spacingLayout.length - 1)

  log(1, 'Layout', layout)
  log(1, 'Spacing', space)

  var spacing = {
    layout: layout,
    space: space,
  }

  log(1, 'Values', values)
  log(1, 'Values count', values.length)

  if (values.length > 1) {
    var alignment = values[1]

    if (alignment == "left") {
      alignment = "l"
    }
    if (alignment == "right") {
      alignment = "r"
    }
    if (alignment == "top") {
      alignment = "t"
    }
    if (alignment == "bottom") {
      alignment = "b"
    }
    if (alignment == "center" || alignment == "centre" || alignment == "h" || alignment == "horizontally") {
      alignment = "c"
    }
    if (alignment == "middle" || alignment == "v" || alignment == "vertically") {
      alignment = "m"
    }

    log(1, 'Alignment', alignment)

    if (alignment) {
      spacing.align = alignment
    }
  }

  return spacing
}

function simplifyAlignment(alignment) {
  if (alignment == "left") {
    alignment = "l"
  }
  else if (alignment == "right") {
    alignment = "r"
  }
  else if (alignment == "top") {
    alignment = "t"
  }
  else if (alignment == "bottom") {
    alignment = "b"
  }
  else if (alignment == "center" || alignment == "centre" || alignment == "h" || alignment == "horizontally") {
    alignment = "c"
  }
  else if (alignment == "middle" || alignment == "v" || alignment == "vertically") {
    alignment = "m"
  }

  if (alignment == 'l' || alignment == 'r' || alignment == 't' || alignment == 'b' || alignment == 'c' || alignment == 'm') {
    return alignment
  }

  return nil
}



/**
 * Return a default padding object
 */
function defaultSpacing() {
  return {
    layout: "v",
    space: 20
  }
}



function applySpacingToGroup(spacing, groupLayer) {
  if (!spacing) return

  // Get the current group position
  var beginningX = groupLayer.frame().x()
  var beginningY = groupLayer.frame().y()

  // Valid layers for spacing
  var layers = filter(groupLayer.layers(), function(layer) {
    if (layerHasPadding(layer))
      return false
    if (layer.isMemberOfClass(MSArtboardGroup))
      return false
    if (layer.isMemberOfClass(MSSliceLayer))
      return false
    if (layer.name().startsWith('-'))
      return false
    return true
  })

  log(2, 'Will space layers', layers.map(function(layer) {
    return layer.name() + "\n"
  }))

  var sortedLayers = layers.sort(function(a, b) {
    if (spacing.layout == "v") {
      return a.frameForTransforms().origin.y <= b.frameForTransforms().origin.y ? -1 : 1
    } else if (spacing.layout == "h") {
      return a.frameForTransforms().origin.x <= b.frameForTransforms().origin.x ? -1 : 1
    }
  })

  var previous = sortedLayers[0]
  var minX = frameForLayer(previous).minX()
  var minY = frameForLayer(previous).minY()
  var maxX = frameForLayer(previous).maxX()
  var maxY = frameForLayer(previous).maxY()

  sortedLayers.forEach(function(layer) {
    if (layer == previous) return

    // The amount to offset the layer
    var x = 0
    var y = 0

    if (spacing.layout == "v") {
      y = spacing.space - frameForLayer(layer).minY() + frameForLayer(previous).maxY()
    } else if (spacing.layout == "h") {
      x = spacing.space - frameForLayer(layer).minX() + frameForLayer(previous).maxX()
    }

    offsetLayer(layer, x, y)
    previous = layer


    if(frameForLayer(previous).minX() < minX)
      minX = frameForLayer(previous).minX()

    if(frameForLayer(previous).minY() < minY)
      minY = frameForLayer(previous).minY()

    if(frameForLayer(previous).maxX() > maxX)
      maxX = frameForLayer(previous).maxX()

    if(frameForLayer(previous).maxY() < maxY)
      maxY = frameForLayer(previous).maxY()

  })

  if (spacing.align) {



    log(2, 'Will align layers', layers.map(function(layer) {
      return layer.name() + "\n"
    }))
    // if (spacing.layout == "v") {
    layers.forEach(function(layer) {
      if (spacing.align == "l") {
        layer.frame().setX(minX)
      } else if (spacing.align == "r") {
        layer.frame().setMaxX(maxX)
      } else if (spacing.align == "c") {
        var mid = minX + (maxX - minX) / 2
        layer.frame().setMidX(mid)
      }
    })

  // } else if (spacing.layout == "h") {
    layers.forEach(function(layer) {
      if (spacing.align == "t") {
        layer.frame().setY(minY)
      } else if (spacing.align == "b") {
        layer.frame().setMaxY(maxY)
      } else if (spacing.align == "m") {
        var mid = minY + (maxY - minY) / 2
        layer.frame().setMidY(mid)
      }
    })
  }



  log(2, 'Sorted layers', sortedLayers)
  groupLayer.layerDidEndResize()

  // Reset the position to be the same
  groupLayer.frame().setX(beginningX)
  groupLayer.frame().setY(beginningY)
}


function applySpacingToGroupIgnoringBGLayer(spacing, groupLayer, bg) {
  if (!spacing) return

  // Valid layers for spacing
  var layers = filter(groupLayer.layers(), function(layer) {
    if (layer == bg && layerHasPadding(bg))
      return false
    if (layer.isMemberOfClass(MSArtboardGroup))
      return false
    if (layer.isMemberOfClass(MSSliceLayer))
      return false
    if (layer.name().startsWith('-'))
      return false
    return true
  })

  log(2, 'Will space layers', layers.map(function(layer) {
    return layer.name() + "\n"
  }))

  var sortedLayers = layers.sort(function(a, b) {
    if (spacing.layout == "v") {
      return a.frameForTransforms().origin.y <= b.frameForTransforms().origin.y ? -1 : 1
    } else if (spacing.layout == "h") {
      return a.frameForTransforms().origin.x <= b.frameForTransforms().origin.x ? -1 : 1
    }
  })

  var previous = sortedLayers[0]
  var minX = frameForLayer(previous).minX()
  var minY = frameForLayer(previous).minY()
  var maxX = frameForLayer(previous).maxX()
  var maxY = frameForLayer(previous).maxY()

  sortedLayers.forEach(function(layer) {
    if (layer == previous) return

    // The amount to offset the layer
    var x = 0
    var y = 0

    if (spacing.layout == "v") {
      y = spacing.space - frameForLayer(layer).minY() + frameForLayer(previous).maxY()
    } else if (spacing.layout == "h") {
      x = spacing.space - frameForLayer(layer).minX() + frameForLayer(previous).maxX()
    }

    offsetLayer(layer, x, y)
    previous = layer


    if(frameForLayer(previous).minX() < minX)
      minX = frameForLayer(previous).minX()

    if(frameForLayer(previous).minY() < minY)
      minY = frameForLayer(previous).minY()

    if(frameForLayer(previous).maxX() > maxX)
      maxX = frameForLayer(previous).maxX()

    if(frameForLayer(previous).maxY() < maxY)
      maxY = frameForLayer(previous).maxY()

  })

  if (spacing.align) {

    log(2, 'Will align layers', layers.map(function(layer) {
      return layer.name() + "\n"
    }))
    if (spacing.layout == "v") {
      layers.forEach(function(layer) {
        if (spacing.align == "l") {
          layer.frame().setX(minX)
        } else if (spacing.align == "r") {
          layer.frame().setMaxX(maxX)
        } else if (spacing.align == "c") {
          var mid = minX + (maxX - minX) / 2
          layer.frame().setMidX(mid)
        }
      })

    } else if (spacing.layout == "h") {
      layers.forEach(function(layer) {
        if (spacing.align == "t") {
          layer.frame().setY(minY)
        } else if (spacing.align == "b") {
          layer.frame().setMaxX(maxY)
        } else if (spacing.align == "m") {
          var mid = minY + (maxY - minY) / 2
          layer.frame().setMidY(mid)
        }
      })
    }
  }



  log(2, 'Sorted layers', sortedLayers)
  groupLayer.layerDidEndResize()
}

function frameForLayer(layer) {
  return MSRect.rectWithRect(layer.frameForTransforms())
}


// Offset a layer's position by x and y
function offsetLayer(layer, x, y) {
  layer.frame().setX(layer.frame().x() + x)
  layer.frame().setY(layer.frame().y() + y)

  // Since the layer has moved, it's parent's frame may need to be updated
  var parent = layer.parentGroup()
  if (parent) {
    parent.resizeToFitChildrenWithOption(0)
  }
}

//
// actionWithType(context,"MSAlignLayersBottomAction").doPerformAction(nil);
//
// MSAlignLayersTopAction
// MSAlignLayersLeftAction
// MSAlignLayersRightAction
// MSAlignLayersBottomAction
// MSAlignLayersCenterAction
// MSAlignLayersMiddleAction
//
// function actionWithType(context,type) {
// 	var controller = context.document.actionsController();
//
// 	if (controller.actionWithName) {
// 		return controller.actionWithName(type);
// 	} else if (controller.actionWithID) {
// 		return controller.actionWithID(type);
// 	} else {
// 		return controller.actionForID(type);
// 	}
// }
