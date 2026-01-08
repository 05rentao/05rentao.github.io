const canvas = document.getElementById('ascii-canvas');
let charWidth = 6;
let charHeight = 12;

function measureCharSize() {
    const span = document.createElement('span');
    span.style.position = 'absolute';
    span.style.whiteSpace = 'pre';
    span.style.visibility = 'hidden';
    const canvasStyle = getComputedStyle(canvas);
    span.style.font = canvasStyle.font;
    span.textContent = 'M';
    document.body.appendChild(span);
    const rect = span.getBoundingClientRect();
    document.body.removeChild(span);

    // each logical cell will be two characters wide ("dot + space"), so account for that
    charWidth = rect.width * 2;
    charHeight = rect.height;
}

let cols, rows;
let grid = [];
let gridTimestamps = [];
let mouseX = -1, mouseY = -1;
const trailDuration = 100;

let boxesList = [];
let draggedBox = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

function initGrid() {
    measureCharSize();

    cols = Math.ceil(window.innerWidth / charWidth);
    rows = Math.ceil(window.innerHeight / charHeight);
    grid = [];
    gridTimestamps = [];

    for (let y = 0; y < rows; y++) {
        grid[y] = [];
        gridTimestamps[y] = [];
        for (let x = 0; x < cols; x++) {
            grid[y][x] = '. ';
            gridTimestamps[y][x] = 0;
        }
    }
}

function initBoxes() {
    // only query the new classes
    const boxes = document.querySelectorAll('.box-dynamic, .box-static');
    boxesList = [];

    boxes.forEach((box, index) => {
        const rect = box.getBoundingClientRect();

        if (!box.hasAttribute('tabindex')) box.setAttribute('tabindex', '0');

        // movable if it has the box-dynamic class
        const movable = box.classList.contains('box-dynamic');

        // ensure static boxes are not editable
        if (!movable) {
            box.contentEditable = false;
            box.classList.remove('editing');
            delete box.dataset.originalContent;
        }

        boxesList.push({
            element: box,
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
            movable
        });

        // ensure explicit class is present (optional safeguard)
        if (movable) {
            box.classList.add('box-dynamic');
            box.classList.remove('box-static');
        } else {
            box.classList.add('box-static');
            box.classList.remove('box-dynamic');
        }

        // attach drag handler only for dynamic boxes
        if (movable) {
            box.addEventListener('mousedown', (e) => {
                if (box.isContentEditable || box.classList.contains('editing')) return;
                if (e.detail > 1) return;

                const boxData = boxesList[index];
                const rect = box.getBoundingClientRect();
                draggedBox = boxData;

                dragOffsetX = e.clientX - rect.left;
                dragOffsetY = e.clientY - rect.top;

                box.style.zIndex = 10;
                
                // freeze width/avoid wrapping while dragging
                box.style.width = rect.width + 'px';
                e.preventDefault();
            });

            // only dynamic boxes get editing handlers
            box.addEventListener('dblclick', (e) => {
                if (box.querySelector('img')) return;

                box.dataset.originalContent = box.innerHTML;

                box.contentEditable = true;
                box.classList.add('editing');
                box.focus();

                const range = document.createRange();
                range.selectNodeContents(box);
                range.collapse(false);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);

                e.stopPropagation();
            });

            box.addEventListener('blur', () => {
                if (box.isContentEditable) finishEditing(box);
            });

            box.addEventListener('keydown', (e) => {
                if (!box.isContentEditable) return;
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    box.blur();
                } else if (e.key === 'Escape') {
                    box.innerHTML = box.dataset.originalContent || box.innerHTML;
                    box.blur();
                }
            });
        }
    });
}

function updateBoxPositions() {
    boxesList.forEach(boxData => {
        const rect = boxData.element.getBoundingClientRect();
        boxData.x = rect.left;
        boxData.y = rect.top;
        boxData.width = rect.width;
        boxData.height = rect.height;
    });
}

function finishEditing(box) {
    // static boxes should never be edited — no-op and ensure clean state
    if (box.classList.contains('box-static')) {
        box.contentEditable = false;
        box.classList.remove('editing');
        delete box.dataset.originalContent;
        return;
    }

    box.contentEditable = false;
    box.classList.remove('editing');

    const text = box.innerText.trim();
    box.innerHTML = text.replace(/\n/g, '<br>');

    delete box.dataset.originalContent;

    setTimeout(() => {
        updateBoxPositions();
    }, 0);
}

function isInsideBox(x, y) {
    for (let box of boxesList) {
        if (x >= box.x && x <= (box.x + box.width) &&
            y >= box.y && y <= (box.y + box.height)) {
            return true;
        }
    }
    return false;
}

function drawBoxBorder(x, y, width, height) {
    const padding = 0;
    const startCol = Math.floor((x - padding) / charWidth);
    const startRow = Math.floor((y - padding) / charHeight);
    const endCol = Math.floor((x + width + padding) / charWidth);
    const endRow = Math.floor((y + height + padding) / charHeight);

    for (let col = startCol; col <= endCol; col++) {
        if (col >= 0 && col < cols) {
            if (startRow >= 0 && startRow < rows) {
                grid[startRow][col] = '- ';
            }
            if (endRow >= 0 && endRow < rows) {
                grid[endRow][col] = '- ';
            }
        }
    }

    for (let row = startRow; row <= endRow; row++) {
        if (row >= 0 && row < rows) {
            if (startCol >= 0 && startCol < cols) {
                grid[row][startCol] = '| ';
            }
            if (endCol >= 0 && endCol < cols) {
                grid[row][endCol] = '| ';
            }
        }
    }

    if (startRow >= 0 && startRow < rows && startCol >= 0 && startCol < cols) {
        grid[startRow][startCol] = '+ ';
    }
    if (startRow >= 0 && startRow < rows && endCol >= 0 && endCol < cols) {
        grid[startRow][endCol] = '+ ';
    }
    if (endRow >= 0 && endRow < rows && startCol >= 0 && startCol < cols) {
        grid[endRow][startCol] = '+ ';
    }
    if (endRow >= 0 && endRow < rows && endCol >= 0 && endCol < cols) {
        grid[endRow][endCol] = '+ ';
    }
}

function updateGrid() {
    const now = Date.now();

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            // compute center pixel for box/inside checks
            const pixelX = x * charWidth + (charWidth / 2);
            const pixelY = y * charHeight + (charHeight / 2);

            if (isInsideBox(pixelX, pixelY)) {
                // inside boxes should be fully blank (two spaces)
                grid[y][x] = '  ';
            } else {
                // background uses "dot + space" per cell
                grid[y][x] = '. ';
            }
        }
    }

    if (mouseX >= 0 && mouseY >= 0) {
        const centerX = Math.floor(mouseX / charWidth);
        const centerY = Math.floor(mouseY / charHeight);

        if (centerY >= 0 && centerY < rows && centerX >= 0 && centerX < cols) {
            // compute pixel center in the same coordinate space used by isInsideBox
            const pixelX = centerX * charWidth + (charWidth / 2);
            const pixelY = centerY * charHeight + (charHeight / 2);

            if (!isInsideBox(pixelX, pixelY)) {
                // trail mark is an asterisk + space
                grid[centerY][centerX] = '* ';
                gridTimestamps[centerY][centerX] = now;
            }
        }
    }

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            if (gridTimestamps[y][x] > 0) {
                const age = now - gridTimestamps[y][x];
                const pixelX = x * charWidth + (charWidth / 2);
                const pixelY = y * charHeight + (charHeight / 2);

                if (age <= trailDuration && !isInsideBox(pixelX, pixelY)) {
                    // only restore trail if the cell is still background (dot + space)
                    if (grid[y][x] === '. ') {
                        grid[y][x] = '* ';
                    }
                } else {
                    gridTimestamps[y][x] = 0;
                }
            }
        }
    }

    boxesList.forEach(box => {
        drawBoxBorder(box.x, box.y, box.width, box.height);
    });
}

function render() {
    let output = '';
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            output += grid[y][x];
        }
        output += '\n';
    }
    canvas.textContent = output;
}

function animate() {
    updateBoxPositions();
    updateGrid();
    render();
    requestAnimationFrame(animate);
}

document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    if (draggedBox) {
        const parentRect = (draggedBox.element.offsetParent || document.documentElement).getBoundingClientRect();

        const newXLocal = e.clientX - dragOffsetX - parentRect.left;
        const newYLocal = e.clientY - dragOffsetY - parentRect.top;

        const globalX = newXLocal + parentRect.left;
        const globalY = newYLocal + parentRect.top;

        // snap to character grid
        let snappedGlobalX = Math.round(globalX / charWidth) * charWidth;
        let snappedGlobalY = Math.round(globalY / charHeight) * charHeight;

        // clamp so the box stays within the viewport bounds and below the nav
        const nav = document.querySelector('nav');
        const navBottom = nav ? nav.getBoundingClientRect().bottom : 0;

        const boxWidth = draggedBox.width || draggedBox.element.offsetWidth;
        const boxHeight = draggedBox.height || draggedBox.element.offsetHeight;

        const minGlobalX = 0;
        const maxGlobalX = Math.max(0, window.innerWidth - boxWidth);
        const minGlobalY = navBottom;
        const maxGlobalY = Math.max(minGlobalY, window.innerHeight - boxHeight);

        const clampedGlobalX = Math.min(Math.max(snappedGlobalX, minGlobalX), maxGlobalX);
        const clampedGlobalY = Math.min(Math.max(snappedGlobalY, minGlobalY), maxGlobalY);

        const clampedLocalX = clampedGlobalX - parentRect.left;
        const clampedLocalY = clampedGlobalY - parentRect.top;

        draggedBox.element.style.left = clampedLocalX + 'px';
        draggedBox.element.style.top = clampedLocalY + 'px';

        const rect = draggedBox.element.getBoundingClientRect();
        draggedBox.x = rect.left;
        draggedBox.y = rect.top;
        draggedBox.width = rect.width;
        draggedBox.height = rect.height;
    }
});

document.addEventListener('mouseup', () => {
    if (draggedBox) {
        draggedBox.element.style.zIndex = 5;
        draggedBox = null;
    }
});

document.addEventListener('mouseleave', () => {
    mouseX = -1;
    mouseY = -1;
});

window.addEventListener('resize', () => {
    measureCharSize();
    initGrid();
    initBoxes();
});

// Navigation behavior: mark active link
function setupNav() {
    const navLinks = document.querySelectorAll('.nav-tabs a.tab');
    if (!navLinks || navLinks.length === 0) return;

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });

    function setActiveLink() {
        const path = window.location.pathname.split('/').pop();
        navLinks.forEach(l => {
            const href = (l.getAttribute('href') || '').split('/').pop();
            if (href === path || (href === 'main.html' && path === '')) {
                l.classList.add('active');
            } else {
                l.classList.remove('active');
            }
        });
    }

    setActiveLink();
}

window.addEventListener('load', () => {
    measureCharSize();
    initGrid();
    initBoxes();
    animate();

    setupNav();

    const fontSizeSlider = document.getElementById('font-size-slider');
    const fontSizeLabel = document.getElementById('font-size-value');
    if (fontSizeSlider && fontSizeLabel) {
        const current = parseInt(getComputedStyle(canvas).fontSize, 10) || 15;
        fontSizeSlider.value = current;
        fontSizeLabel.textContent = current + 'px';

        fontSizeSlider.addEventListener('input', (e) => {
            const v = e.target.value;
            canvas.style.fontSize = v + 'px';
            fontSizeLabel.textContent = v + 'px';

            measureCharSize();
            initGrid();
            render();
        });
    }
});