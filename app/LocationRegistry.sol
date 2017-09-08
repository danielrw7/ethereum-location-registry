pragma solidity ^0.4.0;

contract LocationRegistry {
    struct Coord {
        uint x;
        uint y;
    }

    struct DataPoint {
        address owner;

        Coord pos;
        string data;
    }


    uint maxDecimals = 5;
    // 1.11319m precision
    DataPoint[][18000000][36000000] points;
    
    uint indexDecimals = 3;
    // stores index of coords in 111.319m squares - each index can store up to 10000 coordinates
    Coord[10000][180000][360000] coordsIndex;

    // uint indexIndexDecimals = 2;
    // indexes the indexes
    // Coord[100][18000][36000] indexIndex;

    function getCoord(uint x, uint y) internal returns (Coord) {
        return Coord(x, y);
    }

    function registerPoint(uint x, uint y, string data) {
        Coord memory pos = Coord(x, y);
        uint xIndex = pos.x;
        uint yIndex = pos.y;

        bool replaceIndex = false;
        if (points[xIndex][yIndex].length > 0) {
            points[xIndex][yIndex].length = 0;
            // if (points[xIndex][yIndex][0].owner != msg.sender) throw;
            replaceIndex = true;
        }
        points[xIndex][yIndex].push(DataPoint(msg.sender, pos, data));

        // for now only allowing 1 point per square            
        if (replaceIndex) {
            reindexPoint(pos);
        } else {
            indexPoint(pos);
        }
    }

    function coordsEqual(Coord pos1, Coord pos2) constant internal returns (bool isEqual) {
        return pos1.x == pos2.x && pos1.y == pos2.y;
    }

    function indexPoint(Coord pos) internal {
        uint div = 10 ** indexDecimals;
        Coord memory indexPos = Coord(pos.x / div, pos.y / div);
        coordsIndex[pos.x / div][pos.y / div][coordsIndex.length] = pos;
    }

    function reindexPoint(Coord pos) internal {
        uint div = 10 ** indexDecimals;
        Coord memory indexPos = Coord(pos.x / div, pos.y / div);
        uint indexX = indexPos.x;
        uint indexY = indexPos.y;
        uint n = 0;
        for (; n < coordsIndex[indexX][indexY].length; n++) {
            if (coordsEqual(pos, coordsIndex[indexX][indexY][n])) {
                break;
            }
        }
        coordsIndex[indexX][indexY][n] = pos;
    }

    function getNumPointsAtPos(uint x, uint y) constant returns (uint) {
        return points[x][y].length;
    }
    
    function getPoint(uint x, uint y, uint index) constant returns (address, uint, uint, string) {
        DataPoint point = points[x][y][index];
        return (point.owner, point.pos.x, point.pos.y, point.data);
    }

    function getIndexArray(uint x, uint y) constant internal returns (Coord[10000]) {
        uint div = 10 ** indexDecimals;
        uint indexX = x / div;
        uint indexY = y / div;
        return coordsIndex[indexX][indexY];
    }
    
    function getIndexPointCount(uint x, uint y) constant returns (uint) {
        return getIndexArray(x, y).length;
    }

    function getPointFromIndex(uint x, uint y, uint index) constant returns (address, uint, uint, string) {
        Coord memory pos = getIndexArray(x, y)[index];
        return getPoint(pos.x, pos.y, uint(0));
    }

    function getBatchCount(uint fromX, uint fromXPlaces, uint fromY, uint fromYPlaces, uint toX, uint toXPlaces, uint toY, uint toYPlaces) returns (uint totalPoints) {
        uint divideDecimals = maxDecimals - indexDecimals;
        uint step = 10 ** divideDecimals;
        uint total = 0;
        for (uint x = fromX; x <= toX; x = step) {
            for (uint y = fromY; y <= toY; y = step) {
                total += getIndexPointCount(x, y);
            }
        }
        return total;
    }

    // function getBatchX(uint x, uint xPlaces, uint y, uint yPlaces) returns (uint[10000]) {
    //     uint[10000] memory res = new uint[](10000);
    //     Coord[10000] memory indexArray = getIndexArray(x, xPlaces, y, yPlaces);
    //     for (uint n = 0; n < indexArray.length; n++) {
    //         Coord memory pos = indexArray[n];
    //         res[n] = getPoint(pos.x.n, pos.x.p, pos.y.n, pos.y.p, uint(0));
    //     }
    //     return res;
    // }
}