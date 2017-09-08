function makeDecimalObj(n) {
  const res = {
    n: n,
    p: 0
  }
  if (Math.round(n) != n) {
    const spl = n.toString().split('.')
    const digits = spl[1].length
    res.p = Number(digits)
    res.n *= Math.pow(10, res.p)
  }
  return res
}

function getIndexCoords(x, y) {
  return {
    x: makeDecimalObj(x),
    y: makeDecimalObj(y)
  }
}

let baseCoords = getIndexCoords(0, 0)

function checkContractReady(callback) {
  try {
    LocationRegistry.get
    callback()
  } catch (e) {
    setTimeout(checkContractReady.bind(this, callback), 100)
  }
}

function callTransaction(method, args) {
  return method.apply(this, args.concat({gas:1000000}))
}
function callConstant(method, args) {
  return method.apply(this, args.concat({gas:1000000}))
}

const gas = {gas:1000000}

var start = new Date().getTime()

let data = "{}"

function loadIndexGrid() {
  var indexCoords = []

  var $main = $("#main")
  var $title = $main.find(".title")
  var $table = $main.find("table").html('')
  if (!$table.length) {
    $table = $("<table>")
  }

  var $indexForm = $main.find("form")
  var $xInput = $indexForm.find("[name=x]").val(baseCoords.x.n/Math.pow(10, baseCoords.x.p))
  var $yInput = $indexForm.find("[name=y]").val(baseCoords.y.n/Math.pow(10, baseCoords.y.p))
  var $dataInput = $indexForm.find("[name=data]")

  $table.off("click").on("click", "td", function() {
    const point = $(this).data()
    $xInput.val(point.x)
    $yInput.val(point.y)
    if (point.data) {
      $dataInput.val(point.data.data)
    }
  })

  $indexForm.off("submit").submit(_ => {
    baseCoords = getIndexCoords(Number($xInput.val()), Number($yInput.val()))
    data = $dataInput.val()
    LocationRegistry.registerPoint(baseCoords.x.n, baseCoords.x.p, baseCoords.y.n, baseCoords.y.p, data, gas).then(loadIndexGrid)
    return false
  })

  Promise.all([
    LocationRegistry.getIndexCoords(baseCoords.x.n, baseCoords.x.p, baseCoords.y.n, baseCoords.y.p, gas),
    LocationRegistry.getIndexPointCount(baseCoords.x.n, baseCoords.x.p, baseCoords.y.n, baseCoords.y.p, gas),
  ]).then(([coords, count]) => {
    console.log(coords, count)
    coords = coords.map(d => d.toNumber())
    count = count.toNumber()
    var size = Math.pow(10, coords[2])
    indexCoords = {
      x: coords[0]*size,
      y: coords[1]*size
    }
    $title.text(`(${indexCoords.x},${indexCoords.y} to ${indexCoords.x+size-1},${indexCoords.y+size-1})`)
    console.log('coords are',indexCoords)
    console.log('count is',count)

    var relativeIndex = {}

    const promises = []
    for (let n = 0; n < count; n++) {
      promises.push(new Promise(function(resolve, reject) {
        console.log(indexCoords.x,0,indexCoords.y,0,n)
        LocationRegistry.getPointFromIndex(indexCoords.x,0,indexCoords.y,0,n,gas).then(function(data) {
          let point = {
            owner: data[0],
            coords: {
              x: data[1].toNumber()/Math.pow(10,data[2].toNumber()),
              y: data[3].toNumber()/Math.pow(10,data[4].toNumber()),
            },
            data: data[5]
          }
          resolve(point)
        }).catch(reject)
      }))
    }
    Promise.all(promises).then(points => {
      points.forEach(point => {
        relativeIndex[Math.floor(point.coords.x - indexCoords.x)+':'+Math.floor(point.coords.y - indexCoords.y)] = point
      })
    }).catch(function(e) {
      throw e
    }).then(function() {
      console.log('size is',size)
      for (let y = 0; y < size; y++) {
        var $tr = $("<tr>")
        for (let x = 0; x < size; x++) {
          var $td = $("<td>")
          var key = x+':'+y
          $td.attr('title',(indexCoords.x+x)+' '+(indexCoords.y+y))
          if (relativeIndex[key]) {
            let point = relativeIndex[key]
            $td.addClass('point')
            $td.attr('title',(point.coords.x)+' '+(point.coords.y))
            $td.text(point.data)
          }
          $td.data({
            x: x,
            y: y,
            data: relativeIndex[key],
          })
          $tr.append($td)
        }
        $table.append($tr)
      }
      $main.append($table)
      console.log('took',(new Date().getTime()-start),'ms')
    })

  })
}

var blocksPerLat = 100000
var blocksPerLng = 100000
function coordsToLatLng(coords) {
  return {
    lat: (coords.y / blocksPerLat) - 90,
    lng: (coords.x / blocksPerLng)
  }
}
function latLngToCoords(latLng) {
  return {
    x: (fixLng(latLng.lng)) * blocksPerLng,
    y: (fixLat(latLng.lat)) * blocksPerLat
  }
}

function fixLat(lat) {
  lat += 90
  return lat
}

function fixLng(lng) {
  lng = lng % 360
  if (lng < 0) {
    lng += 360
  }
  return lng
}


const addPolys = true

function renderBlockPoly(x, y) {
  if (addPolys) {
    const polyCoords = [coordsToLatLng({x:x,y:y}),coordsToLatLng({x:x+100,y:y+100})]
    // console.log(polyCoords,[x,y])
    var polygon = L.polygon([
      [polyCoords[0].lat, polyCoords[0].lng],
      [polyCoords[1].lat, polyCoords[0].lng],
      [polyCoords[1].lat, polyCoords[1].lng],
      [polyCoords[0].lat, polyCoords[1].lng],
    ], {
      fillOpacity: 0.1,
    }).addTo(map)
  }
}

function renderBlock(map, x, y) {
  return function(resolve, reject) {

    LocationRegistry.getIndexPointCount(x, 0, y, 0, gas).then(function(c) {
      const count = c.toNumber()
      if (!count) return renderBlockPoly(x, y) && resolve([])

      const promises = []
      for (let n = 0; n < count; n++) {
        promises.push(new Promise(function(res, rej) {
          console.log(x,0,y,0,n)
          LocationRegistry.getPointFromIndex(x, 0, y, 0, n, gas).then(function(data) {
            console.log('got the data',data)
            let point = {
              owner: data[0],
              coords: {
                x: data[1].toNumber()/Math.pow(10,data[2].toNumber()),
                y: data[3].toNumber()/Math.pow(10,data[4].toNumber()),
              },
              data: data[5]
            }
            res(point)
          }).catch(rej)
        }).catch(e=>{
          throw e
        }))
      }
      Promise.all(promises).then(points => {
        console.log('got here')
        renderBlockPoly(x, y)
        if (!points || !points.length) return 
        points.forEach(point => {
          const latLng = coordsToLatLng(point.coords)
          console.log([latLng.lat, latLng.lng])
          var marker = L.marker([latLng.lat, latLng.lng]).addTo(map)
          marker.bindPopup(point.data)
        })
        
        resolve()
      }).catch(console.error.bind(console))
    }).catch(console.error.bind(console))
  }
}

var map;
// $(checkloadIndexGrid)
$(function() {
  let initialPos = [0, 0]
  let initialZoom = 0
  if (window.location.hash.length > 1) {
    let savedPos = window.location.hash.replace('#','').split(',')
    initialPos[0] = Number(savedPos[0]) || 0
    initialPos[1] = Number(savedPos[1]) || 0
    initialZoom = Number(savedPos[2]) || 2
  }

  map = L.map('map').setView(initialPos, initialZoom)

  const pinPromises = {}

  function renderPins([fromX, fromY], [toX, toY]) {
    const promises = []

    // LocationRegistry.getBatchCount(fromX, 0, fromY, 0, toX, 0, toY, 0, gas).then(d => {
    //   console.log(d.toNumber(),'pins')
    // })

    for (let x = fromX; x <= toX; x += 100) {
      for (let y = fromY; y <= toY; y += 100) {
        let key = `${x}:${y}`
        if (!pinPromises[key]) {
          pinPromises[key] = new Promise(renderBlock(map,x,y))
        }
        promises.push(pinPromises[key])
      }
    }
    console.log(promises.length)
    spinner.jobs++
    Promise.all(promises).then(_ => {
      spinner.jobs--
    }).catch(function(e) {
      throw e
    })
  }

  corner1 = L.latLng(-90, -180)
  corner2 = L.latLng(90, 180)

  L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoiZGFuaWVscnciLCJhIjoiY2ozM2Vpems4MDA1bjMybzlqZGFub2RpNCJ9.0v69FaMeIiW7bZpy62LUkA', {
    attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
    maxZoom: 30,
    minZoom: 3,
    id: 'mapbox.streets',
    maxBounds: L.latLngBounds(corner1, corner2),
    worldCopyJump: true
  }).addTo(map)

  var $main = $("#main")
  var $indexForm = $main.find("form")
  var $xInput = $indexForm.find("[name=x]")
  var $yInput = $indexForm.find("[name=y]")
  var $dataInput = $indexForm.find("[name=data]")

  // $indexForm.off("submit").submit(_ => {
  //   baseCoords = getIndexCoords(Number($xInput.val()), Number($yInput.val()))
  //   data = $dataInput.val()
  //   LocationRegistry.registerPoint(baseCoords.x.n, baseCoords.x.p, baseCoords.y.n, baseCoords.y.p, data, gas).then(console.log.bind(console,'did it'))
  //   return false
  // })

  $("body").on("submit", ".leaflet-popup-content form", function() {
    var $form = $(this)
    var data = $form.find("input").val()
    const coords = latLngToCoords(addMarker._latlng)
    const decimalCoords = getIndexCoords(coords.x, coords.y)
    addMarker.bindPopup("Loading...").openPopup()
    spinner.jobs++
    LocationRegistry.registerPoint(decimalCoords.x.n, decimalCoords.x.p, decimalCoords.y.n, decimalCoords.y.p, data, gas).then(_ => {
      spinner.jobs--
      addMarker.bindPopup(data).openPopup()
      addMarker = false
    })
    return false
  })

  var loading = {

  }

  let addMarker

  let points = []
  map.on('click', function(e) {
    console.log('here!')
    // points.push([e.latlng.lat, e.latlng.lng])
    // if (points.length == 4) {
    //   var polygon = L.polygon(points).addTo(map)
    //   points = []
    // }
    if (addMarker && addMarker.remove) {
      addMarker.remove()
    }

    addMarker = L.marker([e.latlng.lat, e.latlng.lng]).addTo(map)
    addMarker.bindPopup(`
      <form>
        <input value="test"/> <button>Tag</button>
      </form>
    `).openPopup()
    console.log(addMarker)

    const coords = latLngToCoords(e.latlng)

    console.log(coords)
    $xInput.val(coords.x)
    $yInput.val(coords.y)
  })

  map.on('popupclose', _=> {
    if (addMarker && addMarker.remove) {
      addMarker.remove()
    }
  })

  var maxBlocks = 100

  function render() {
    var center = map.getCenter()
    var zoom = map.getZoom()
    var url = `${window.location.origin}${window.location.pathname}#${center.lat},${center.lng},${zoom}`
    window.history.replaceState({}, window.location.pathname, url)

    if (center.lng != fixLng(center.lng)) {
      map.setView([center.lat, fixLng(center.lng)], zoom)
      return
    }

    const bounds = map.getBounds()
    var blocksWidth = Math.ceil((bounds._northEast.lat - bounds._southWest.lat) * 1000);
    var blocksHeight = Math.ceil((bounds._northEast.lng - bounds._southWest.lng) * 1000);
    var numBlocks = blocksWidth*blocksHeight
    console.log(numBlocks, maxBlocks)
    if (numBlocks <= maxBlocks) {
      var topLeft = latLngToCoords({
        lat: bounds._northEast.lat,
        lng: bounds._southWest.lng,
      })
      var bottomRight = latLngToCoords({
        lat: bounds._southWest.lat,
        lng: bounds._northEast.lng,
      })
      var blockLeft = Math.floor(topLeft.x / 100) * 100
      var blockRight = Math.ceil(bottomRight.x / 100) * 100
      var blockTop = Math.ceil(topLeft.y / 100) * 100
      var blockBottom = Math.floor(bottomRight.y / 100) * 100

      if (blockLeft > blockRight) {
        // the earth is round :/
        renderPins([blockLeft, blockTop], [0, blockBottom])
        blockLeft = 0
      }
      if (blockLeft != blockRight) {
        renderPins([blockLeft, blockBottom], [blockRight, blockTop])
      }
      // var promises = []
      // for (var x = 0; x <= blockRight; x += 100) {
      //   for (var y = 0; y <= blockRight; x += 100) {
        
      //   }
      // }
    }
  }

  map.on('moveend', render)

  $(".my-location").click(function() {
    navigator.geolocation.getCurrentPosition(function(location) {
      map.setView([location.coords.latitude, fixLng(location.coords.longitude)], 20)
    });
  })

  checkContractReady(render)

  spinner.$el = $("#spinner")
})

var spinner = {
  _jobs: 0,
  set jobs(val) {
    this._jobs = val
    if (this._jobs > 0) {
      this.show()
    } else {
      this.hide()
    }
  },
  get jobs() {
    return this._jobs
  },
  $el: false,
  show() {
    this.$el.show()
  },
  hide() {
    this.$el.hide()
  }
}
