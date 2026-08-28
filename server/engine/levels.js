'use strict';

const { SCREEN_WIDTH, brickMetrics, brickColumnsForWorld } = require('./layout.js');
const { Brick } = require('./entities.js');

function loadLevel(levelNumber, aiGeneratedGrid = null, numScreens = 3, screenWidth = SCREEN_WIDTH){
  try {
    let newBricks = [];
    const m = brickMetrics(screenWidth);
    const brickAt = (r, c) => new Brick(
      r, c,
      m.gutter + c * m.cell,
      m.top + r * m.rowPitch,
      m.brickWidth, m.brickHeight
    );

    if(aiGeneratedGrid && Array.isArray(aiGeneratedGrid) && aiGeneratedGrid.length > 0){
      for(let r = 0; r < aiGeneratedGrid.length; r++){
        let rowBricks = [];
        for(let c = 0; c < aiGeneratedGrid[r].length; c++){
          let val = aiGeneratedGrid[r][c];
          let brick = brickAt(r, c);
          if(val > 0){
            brick.type = val===3 ? 'indestructible' : (val===2 ? 'hard' : 'normal');
          }else{
            brick.active = false;
          }
          rowBricks.push(brick);
        }
        newBricks.push(rowBricks);
      }
      return newBricks;
    }

    let numCols = brickColumnsForWorld(numScreens);
    for(let row = 0; row < 8; row++){
      let rowBricks = [];
      for(let col = 0; col < numCols; col++){
        let brickType = 'normal';
        let active = true;

        if(levelNumber===2 && (row+col) % 3===0){
          brickType = 'hard';
        }else if(levelNumber===3){
          if((row===3 || row===4) && col % 4 === 0){
            brickType = 'indestructible';
          }else if(col % 2===0){
            brickType = 'hard';
          }
        }else if(levelNumber===4){
          if((row + col) % 2 === 0) brickType = 'hard';
          if(row === 7 && col % 4 === 0) brickType = 'indestructible';
        }else if(levelNumber>=5){
          const edge = col === 0 || col === numCols - 1;
          if(edge && row < 2){
            brickType = 'indestructible';
          }else if((row + col) % 2 === 0){
            brickType = 'hard';
          }
        }

        let brick = brickAt(row, col);
        brick.type = brickType;
        brick.active = active;
        rowBricks.push(brick);
      }
      newBricks.push(rowBricks);
    }
    return newBricks;
  } catch(error){
    console.error('loadLevel failed, using stock layout', error && error.message);
    if (aiGeneratedGrid) return loadLevel(levelNumber, null, numScreens, screenWidth);
    const m = brickMetrics(screenWidth);
    const cols = brickColumnsForWorld(numScreens);
    const fallback = [];
    for (let row = 0; row < 4; row++) {
      const rowBricks = [];
      for (let col = 0; col < cols; col++) {
        rowBricks.push(new Brick(
          row, col,
          m.gutter + col * m.cell,
          m.top + row * m.rowPitch,
          m.brickWidth, m.brickHeight
        ));
      }
      fallback.push(rowBricks);
    }
    return fallback;
  }
}

module.exports = { loadLevel };
