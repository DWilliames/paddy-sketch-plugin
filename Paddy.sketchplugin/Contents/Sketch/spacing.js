@import 'utils.js'

/*
Example spacing object: [20v]

{
  layout: vertical,
  space: 20,
  align: [c, m]
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
  if (!layer) return false
  if (!canLayerHaveSpacing(layer)) return false

  var spacingString = layerSpacingString(layer)
  if (!spacingString) return false

  return (spacingFromString(spacingString) != null)
}


/**
 * Return the raw padding value
 * The string between '[' and ']'
 */
function layerSpacingString(layer) {
  if (!layer) return

  var regex = /.*\[(.*)\]/g
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

    spacingString += spacing.align.join(' ')
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

  var spacing = {}

  var values = string.split(' ')

  // Check if first value is 'spacing'
  var spacingLayout = values[0]

  var layout = spacingLayout.slice(-1)
  if (layout == 'v' || layout == 'h') {
    // Spacing exists
    var space = spacingLayout.substring(0, spacingLayout.length - 1)

    log(1, 'Layout', layout)
    log(1, 'Spacing', space)

    if (parseFloat(space).toString() != space) {
      log(2, 'Spacing is invalid', string)
      return null
    }

    spacing.layout = layout
    spacing.space = space

    values.shift() // Remove the first element
  }

  var alignments = []
  var invalidAlignment = false
  values.forEach(function(value) {
    var alignment = simplifyAlignment(value)
    if (alignment) {
      alignments.push(alignment)
    } else if (value) {
      invalidAlignment = true
      return
    }
  })

  if (invalidAlignment) {
    log(2, 'Alignments is invalid', string)
    return null
  }

  if (alignments.length > 0) {
    spacing.align = alignments
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
    if (shouldLayerBeIgnored(layer))
      return false
    return true
  })

  if (layers.length == 0) {
    log(2, 'No layers to space')
    return
  }

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
  var previousFrame = frameForLayer(previous)

  var minX = previousFrame.minX()
  var minY = previousFrame.minY()
  var maxX = previousFrame.maxX()
  var maxY = previousFrame.maxY()

  sortedLayers.forEach(function(layer) {
    if (layer == previous) return

    var previousFrame = frameForLayer(previous)
    var frame = frameForLayer(layer)
    // The amount to offset the layer
    var x = 0
    var y = 0

    if (spacing.layout == "v") {
      y = spacing.space - frame.minY() + previousFrame.maxY()
    } else if (spacing.layout == "h") {
      x = spacing.space - frame.minX() + previousFrame.maxX()
    }

    offsetLayer(layer, x, y)
    previous = layer


    if(previousFrame.minX() < minX)
      minX = previousFrame.minX()

    if(previousFrame.minY() < minY)
      minY = previousFrame.minY()

    if(previousFrame.maxX() > maxX)
      maxX = previousFrame.maxX()

    if(previousFrame.maxY() > maxY)
      maxY = previousFrame.maxY()

    pixelFitLayer(layer)

  })

  if (spacing.align) {
    log(2, 'Will align layers', layers.map(function(layer) {
      return layer.name() + "\n"
    }))
    // if (spacing.layout == "v") {
    layers.forEach(function(layer) {
      if (arrayContains(spacing.align, 'l')) {
        layer.frame().setX(minX)
      } if (arrayContains(spacing.align, 'r')) {
        layer.frame().setMaxX(maxX)
      } if (arrayContains(spacing.align, 'c')) {
        var mid = minX + (maxX - minX) / 2.0
        layer.frame().setMidX(mid)
      } if (arrayContains(spacing.align, 't')) {
        layer.frame().setY(minY)
      } if (arrayContains(spacing.align, 'b')) {
        layer.frame().setMaxY(maxY)
      } if (arrayContains(spacing.align, 'm')) {
        var mid = minY + (maxY - minY) / 2.0
        layer.frame().setMidY(mid)
      }

      pixelFitLayer(layer)
    })
  }



  log(2, 'Sorted layers', sortedLayers)

  if (pixelFit) {
    beginningX = Math.round(beginningX)
    beginningY = Math.round(beginningY)
  }

  // Reset the position to be the same
  groupLayer.frame().setX(beginningX)
  groupLayer.frame().setY(beginningY)

  resizeLayer(groupLayer)

}


function arrayContains(array, value) {
  return array.indexOf(value) != -1
}


function frameForLayer(layer) {
  if (!layer) return

  return MSRect.rectWithRect(layer.frameForTransforms())
}


// Offset a layer's position by x and y
function offsetLayer(layer, x, y) {
  layer.frame().setX(layer.frame().x() + x)
  layer.frame().setY(layer.frame().y() + y)
}
