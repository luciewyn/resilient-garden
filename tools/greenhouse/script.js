/**
 * ==========================================================================
 * PERMACOMPUTING STUDIO - COMPLETE ENGINE (Vanilla JS)
 * ==========================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. DOM 元素綁定 ---
    const btnSplit = document.getElementById('btn-split');
    const btnOrigColor = document.getElementById('btn-orig-color');
    const btnGrid = document.getElementById('btn-grid');
    const canvas = document.getElementById('main-canvas');
    const singleView = document.getElementById('single-view');
    const gridView = document.getElementById('grid-view');
    const canvasContainer = document.querySelector('.canvas-container');

    // UI 控制項
    const uploadInput = document.getElementById('image-upload');
    const sliderDownsample = document.querySelectorAll('.ascii-slider')[0];
    const sliderBitDepth = document.querySelectorAll('.ascii-slider')[1];
    const sliderDither = document.querySelectorAll('.ascii-slider')[2];
    const selectAlgorithm = document.querySelector('.ascii-select');

    const displayDownsample = document.querySelectorAll('.value-display')[0];
    const displayBitDepth = document.querySelectorAll('.value-display')[1];
    const displayDither = document.querySelectorAll('.value-display')[2];

    const presetButtons = document.querySelectorAll('.presets-grid .btn-ascii');
    const splitter = document.querySelector('.canvas-splitter');

    // 功能按鈕
    const btnInk = document.getElementById('btn-ink');
    const btnExport = document.getElementById('btn-download');
    const btnAddPressedEdition = document.getElementById('btn-add-pressed-edition');
    const pressedEditionAddStatus = document.getElementById('pressed-edition-add-status');

    // Empty state / webcam UI
    const emptyState = document.getElementById('empty-state');
    const emptyStateError = document.getElementById('empty-state-error');
    const dropMessage = document.getElementById('drop-message');
    const webcamView = document.getElementById('webcam-view');
    const webcamPreview = document.getElementById('webcam-preview');
    const btnWebcamEmpty = document.getElementById('btn-webcam-empty');
    const btnWebcamSidebar = document.getElementById('btn-webcam-sidebar');
    const btnWebcamCapture = document.getElementById('btn-webcam-capture');
    const btnWebcamCancel = document.getElementById('btn-webcam-cancel');

    // Every control that only makes sense once at least one image exists
    // in the library. One shared state (body.has-image / .has-no-image,
    // plus body.webcam-active while a live stream is showing) drives all
    // of them together instead of individual, unrelated enable/disable calls.
    const requiresImageEls = Array.from(document.querySelectorAll('.requires-image'));

    // --- 2. 全域狀態管理 (State) ---
    let state = {
        image: null,
        origBytes: null, // raw file.size / captured Blob.size of the current source image -- never a KB-rounded/derived value
        imagesList: [],
        isGridView: false,
        downsample: 100,
        bitDepth: 1,
        ditherLvl: 75,
        algorithm: 0, // 0: Floyd, 1: Bayer, 2: Random
        splitPos: 50,
        isInvertMode: false,
        useOrigColor: false,
        isSplitMode: false,
        palette: { dark: [0,0,0], light: [255,255,255] } // 確保預設調色盤存在
    };

    let webcamStream = null;
    let isWebcamLive = false; // true while the live camera preview is showing, regardless of entry point

    // --- 2b. Shared interface state ---
    // Two interface states: EMPTY (no image in the library) and ACTIVE
    // (state.imagesList has at least one entry). This is the single
    // source of truth other code should check -- never infer state from
    // whether the canvas currently has pixels in it.
    function hasImages() {
        return state.imagesList.length > 0;
    }

    function updateInterfaceState() {
        const active = hasImages();
        const controlsEnabled = active && !isWebcamLive;

        document.body.classList.toggle('has-image', active);
        document.body.classList.toggle('has-no-image', !active);
        document.body.classList.toggle('webcam-active', isWebcamLive);

        if (emptyState) emptyState.hidden = active || isWebcamLive;

        requiresImageEls.forEach((el) => {
            if ('disabled' in el) el.disabled = !controlsEnabled;
            el.setAttribute('aria-disabled', String(!controlsEnabled));
        });
    }

    // --- 2c. Empty state / import control helpers ---
    function showEmptyState() {
        if (emptyState) emptyState.hidden = false;
    }
    function hideEmptyState() {
        if (emptyState) emptyState.hidden = true;
    }

    function setEmptyStateError(message) {
        if (!emptyStateError) return;
        if (message) {
            emptyStateError.textContent = message;
            emptyStateError.hidden = false;
        } else {
            emptyStateError.textContent = '';
            emptyStateError.hidden = true;
        }
    }

    let dropMessageTimeout = null;
    function showDropMessage(text) {
        if (!dropMessage) return;
        dropMessage.textContent = text;
        dropMessage.hidden = false;
        if (dropMessageTimeout) clearTimeout(dropMessageTimeout);
        dropMessageTimeout = setTimeout(() => {
            dropMessage.hidden = true;
        }, 2500);
    }

    // --- 3. 多重圖片上傳與純文字清單 UI ---
    function ensureFileListContainer() {
        let fileListContainer = document.getElementById('file-list');
        if (!fileListContainer) {
            fileListContainer = document.createElement('div');
            fileListContainer.id = 'file-list';
            fileListContainer.style.cssText = "margin-top: 15px; display: flex; flex-direction: column; gap: 5px;";
            uploadInput.parentElement.insertAdjacentElement('afterend', fileListContainer);
        }
        return fileListContainer;
    }

    // Shared entry point for both the file input and drag-and-drop --
    // both paths hand real File objects here and end up at the same
    // addImageToLibrary() call, so uploaded and dropped images enter the
    // exact same pipeline.
    function handleFiles(fileList) {
        const files = Array.from(fileList).filter((file) => file.type && file.type.startsWith('image/'));
        if (files.length === 0) return false;

        files.forEach((file) => {
            const reader = new FileReader();

            reader.onload = (event) => {
                const img = new Image();
                // file.size直接傳遞，不經過KB轉換 -- 避免四捨五入後再還原造成誤差
                img.onload = () => addImageToLibrary(img, file.size, file.name);
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });

        return true;
    }

    // Shared image-loading function: both uploaded/dropped files and
    // captured webcam frames arrive here once they are a ready
    // HTMLImageElement, and enter the exact same downstream pipeline
    // (state.imagesList, file-list UI, auto-select, renderCanvas()).
    function addImageToLibrary(img, sizeBytes, name) {
        const fileListContainer = ensureFileListContainer();
        const imageData = { img, sizeBytes, name };
        state.imagesList.push(imageData);

        // 建立純文字終端機風格 UI
        const itemWrapper = document.createElement('div');
        itemWrapper.className = 'file-item';

        const fileBtn = document.createElement('button');
        fileBtn.className = 'btn-ascii file-name-btn';
        const shortName = name.length > 12 ? name.substring(0, 12) + '...' : name;
        fileBtn.innerText = `> ${shortName}`;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-ascii btn-delete';
        deleteBtn.innerText = '[-]';
        deleteBtn.title = 'DELETE IMAGE';

        itemWrapper.appendChild(fileBtn);
        itemWrapper.appendChild(deleteBtn);

        // 點擊切換圖片
        itemWrapper.addEventListener('click', () => {
            Array.from(fileListContainer.children).forEach(wrapper => wrapper.classList.remove('active'));
            itemWrapper.classList.add('active');

            state.image = imageData.img;
            state.origBytes = imageData.sizeBytes;
            updateInterfaceState();
            renderCanvas();
        });

        // 點擊刪除圖片
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止冒泡
            itemWrapper.remove(); // 移除 UI

            const index = state.imagesList.indexOf(imageData);
            if (index > -1) state.imagesList.splice(index, 1);

            if (state.image === imageData.img) {
                if (state.imagesList.length > 0) {
                    const firstItemWrapper = document.getElementById('file-list').firstChild;
                    if(firstItemWrapper) firstItemWrapper.click();
                } else {
                    state.image = null;
                    state.origBytes = null;
                    const ctx = canvas.getContext('2d');
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    if(gridView) gridView.innerHTML = '';
                    updateOrigAndPowerHUD(0, 0, 0);
                    updateOutputHUDEstimate(0, 0);
                    showEmptyState();
                }
            } else if (state.isGridView) {
                renderCanvas();
            }

            updateInterfaceState();
        });

        fileListContainer.appendChild(itemWrapper);

        // 自動觸發載入第一張圖片 (adds to the library; never replaces a
        // currently selected image -- only fires when there isn't one yet).
        // The click handler above already calls updateInterfaceState() in
        // that case, but when an image is already selected (appending a
        // 2nd+ image) that click never fires, so it must be called here
        // too -- otherwise a mid-session capture/upload/drop would leave
        // the interface stuck in whatever locked state a live webcam
        // session left it in.
        if (!state.image) {
            itemWrapper.click();
        } else {
            updateInterfaceState();
        }
    }

    uploadInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
        setTimeout(() => { uploadInput.value = ''; }, 500);
    });

    // --- 3b. Drag-and-drop upload ---
    if (canvasContainer) {
        let dragDepth = 0;

        canvasContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (webcamView && !webcamView.hidden) return;
            canvasContainer.classList.add('drag-active');
        });

        canvasContainer.addEventListener('dragenter', (e) => {
            e.preventDefault();
            if (webcamView && !webcamView.hidden) return;
            dragDepth++;
            canvasContainer.classList.add('drag-active');
        });

        canvasContainer.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dragDepth = Math.max(0, dragDepth - 1);
            if (dragDepth === 0) canvasContainer.classList.remove('drag-active');
        });

        canvasContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            dragDepth = 0;
            canvasContainer.classList.remove('drag-active');

            if (webcamView && !webcamView.hidden) return; // camera active: ignore drops

            const files = e.dataTransfer ? e.dataTransfer.files : null;
            if (!files || files.length === 0) return;

            const accepted = handleFiles(files);
            if (!accepted) {
                showDropMessage('[!] ONLY IMAGE FILES ARE SUPPORTED.');
            }
        });
    }

    // --- 4. 核心渲染管線 ---
    // OUTPUT/SAVED are always the same formula ESTIMATE they originally
    // were (pixel count x effective bit depth x a fixed compression
    // guess), for BOTH single and grid view -- restored after a brief
    // detour through a real canvas.toBlob() measurement, which was
    // reverted because it didn't match what this HUD has always shown
    // (see updateOutputHUDEstimate() below). [ ADD TO PRESSED EDITION ]
    // computes this exact same estimate itself, from the canvas's
    // current dimensions and settings, rather than reading it back off
    // the HUD -- see its handler further down.
    function renderCanvas() {
        if (state.imagesList.length === 0) return;

        if (state.isGridView && gridView) {
            gridView.innerHTML = '';
            let totalOrigBytes = 0, totalEstBytes = 0, totalDark = 0, totalPixels = 0;

            state.imagesList.forEach(item => {
                const c = document.createElement('canvas');
                c.className = 'grid-canvas';
                gridView.appendChild(c);
                const stats = applyPermacomputing(item.img, c, false);

                totalOrigBytes += item.sizeBytes;
                const effectiveBitDepth = state.useOrigColor ? (state.bitDepth * 3) : state.bitDepth;
                totalEstBytes += ((stats.w * stats.h) * (effectiveBitDepth / 8) * 0.15);
                totalDark += stats.darkPixels;
                totalPixels += (stats.w * stats.h);
            });
            updateOrigAndPowerHUD(totalOrigBytes, totalDark, totalPixels);
            updateOutputHUDEstimate(totalOrigBytes, totalEstBytes);
        } else {
            if (!state.image) return;
            const stats = applyPermacomputing(state.image, canvas, state.isSplitMode);
            const effectiveBitDepth = state.useOrigColor ? (state.bitDepth * 3) : state.bitDepth;
            const estBytes = ((stats.w * stats.h) * (effectiveBitDepth / 8) * 0.15);
            updateOrigAndPowerHUD(state.origBytes, stats.darkPixels, (stats.w * stats.h));
            updateOutputHUDEstimate(state.origBytes, estBytes);
        }
    }

// --- 5. 影像處理與抖動演算法 ---
    function applyPermacomputing(sourceImg, targetCanvas, useSplit) {
        const ctx = targetCanvas.getContext('2d', { willReadFrequently: true });
        const scale = state.downsample / 100;
        const MAX_W = 800 * scale;
        let w = sourceImg.width;
        let h = sourceImg.height;

        // 安全防護：避免長寬為 0 導致崩潰
        if (w <= 0 || h <= 0) return { w: 0, h: 0, darkPixels: 0 };

        if (w > MAX_W) { h = Math.floor(h * (MAX_W / w)); w = Math.floor(MAX_W); }

        targetCanvas.width = w;
        targetCanvas.height = h;

        // 動態鎖死外層容器比例
        if (targetCanvas.id === 'main-canvas') {
            targetCanvas.parentElement.style.aspectRatio = `${w} / ${h}`;
        }

        ctx.drawImage(sourceImg, 0, 0, w, h);

        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;
        const splitX = useSplit ? Math.floor(w * (state.splitPos / 100)) : w;
        const startX = w - splitX;

        // ==========================================
        // ✨ 修正核心：前置物理反轉 (Pre-processing Inversion)
        // 在所有演算法執行前，先將目標區域的 RGB 數值顛倒。
        // 這完美解決了 Floyd-Steinberg 的數學符號衝突，且自動支援全彩模式！
        // ==========================================
        if (state.isInvertMode) {
            for (let y = 0; y < h; y++) {
                for (let x = startX; x < w; x++) {
                    const i = (y * w + x) * 4;
                    data[i] = 255 - data[i];     // R
                    data[i+1] = 255 - data[i+1]; // G
                    data[i+2] = 255 - data[i+2]; // B
                }
            }
        }

        const levels = Math.max(1, Math.pow(2, state.bitDepth) - 1);
        let darkPixels = 0;

        for (let y = 0; y < h; y++) {
            for (let x = startX; x < w; x++) {
                const i = (y * w + x) * 4;

                if (state.useOrigColor) {
                    let r = data[i], g = data[i+1], b = data[i+2];
                    if (state.algorithm === 2) {
                        const noise = (Math.random() - 0.5) * (state.ditherLvl / 100) * 255;
                        r += noise; g += noise; b += noise;
                    } else if (state.algorithm === 1) {
                        const bayer = [[0, 128], [192, 64]];
                        const bias = (bayer[y % 2][x % 2] - 128) * (state.ditherLvl / 100);
                        r += bias; g += bias; b += bias;
                    }
                    const newR = Math.round(Math.min(255, Math.max(0, r)) / 255 * levels) * (255 / levels);
                    const newG = Math.round(Math.min(255, Math.max(0, g)) / 255 * levels) * (255 / levels);
                    const newB = Math.round(Math.min(255, Math.max(0, b)) / 255 * levels) * (255 / levels);
                    data[i] = newR; data[i+1] = newG; data[i+2] = newB;

                    if (state.algorithm === 0) {
                        const errR = r - newR, errG = g - newG, errB = b - newB;
                        if (x + 1 < w) addColorErr(data, i + 4, errR, errG, errB, 7/16);
                        if (x - 1 >= startX && y + 1 < h) addColorErr(data, i + (w - 1) * 4, errR, errG, errB, 3/16);
                        if (y + 1 < h) addColorErr(data, i + w * 4, errR, errG, errB, 5/16);
                        if (x + 1 < w && y + 1 < h) addColorErr(data, i + (w + 1) * 4, errR, errG, errB, 1/16);
                    }
                } else {
                    // 這裡的 gray 反轉邏輯已經被拔除，交給上面的前置處理完成
                    let gray = 0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2];
                    let newGray = gray;

                    if (state.algorithm === 2) {
                        newGray = (gray + (Math.random() - 0.5) * (state.ditherLvl / 100) * 255) < 128 ? 0 : 255;
                    } else if (state.algorithm === 1) {
                        const bayer = [[0, 128], [192, 64]];
                        const threshold = bayer[y % 2][x % 2] + ((100 - state.ditherLvl) * 1.2);
                        newGray = gray < threshold ? 0 : 255;
                    }

                    const tc = newGray < 128 ? state.palette.dark : state.palette.light;
                    data[i] = tc[0]; data[i+1] = tc[1]; data[i+2] = tc[2];

                    if (state.algorithm === 0) {
                        const err = (gray - (newGray < 128 ? 0 : 255)) * (state.ditherLvl / 100);
                        if (x + 1 < w) addGrayErr(data, i + 4, err, 7/16);
                        if (x - 1 >= startX && y + 1 < h) addGrayErr(data, i + (w - 1) * 4, err, 3/16);
                        if (y + 1 < h) addGrayErr(data, i + w * 4, err, 5/16);
                        if (x + 1 < w && y + 1 < h) addGrayErr(data, i + (w + 1) * 4, err, 1/16);
                    }
                }

                // 掃描暗態像素以計算省電率
                if(data[i] < 50 && data[i+1] < 50 && data[i+2] < 50) darkPixels++;
            }
        }
        ctx.putImageData(imageData, 0, 0);
        return { w, h, darkPixels };
    }

    function addColorErr(data, i, errR, errG, errB, ratio) {
        data[i] += errR * ratio; data[i+1] += errG * ratio; data[i+2] += errB * ratio;
    }

    function addGrayErr(data, i, err, ratio) {
        const v = data[i] + err * ratio;
        data[i] = v; data[i+1] = v; data[i+2] = v;
    }

    // Auto KiB/MiB unit switching, two decimals -- the SAME rule
    // assets/js/pressed-edition-print.js's formatBytes() uses for PAGE
    // 4's [ IMAGE DATA ], so a value shown here and the same value
    // shown there read identically, not just compute to the same
    // number. Fed both real bytes (FILE, from state.origBytes) and
    // estimate bytes (OUTPUT, from the formula in renderCanvas()) --
    // see the two callers below.
    function formatSizeLabel(bytes) {
        if (bytes == null) return '—';
        const KiB = 1024;
        const MiB = KiB * 1024;
        if (Math.abs(bytes) >= MiB) return (bytes / MiB).toFixed(2) + 'MiB';
        if (Math.abs(bytes) >= KiB) return (bytes / KiB).toFixed(2) + 'KiB';
        return bytes + 'B';
    }

    // FILE + POWER need no encoding step, so these update immediately
    // on every render tick regardless of view mode. origBytes is the
    // raw file.size/Blob.size this image was loaded with -- see
    // state.origBytes above -- never a KB-rounded value converted back.
    function updateOrigAndPowerHUD(origBytes, darkPixels, totalPixels) {
        const hudOrig = document.getElementById('hud-orig');
        const hudPower = document.getElementById('hud-power');

        // Display-only: before any image is loaded (origBytes falsy/0),
        // show a neutral placeholder instead of a visually dominant
        // zero value. The underlying calculations below are unchanged.
        const hasData = origBytes && origBytes > 0;

        if(hudOrig) hudOrig.innerText = hasData ? formatSizeLabel(origBytes) : '—';

        if (hasData && totalPixels > 0) {
            const powerSaved = Math.round((darkPixels / totalPixels) * 100);
            if(hudPower) hudPower.innerText = `${powerSaved}%`;
        } else {
            if(hudPower) hudPower.innerText = '—';
        }
    }

    // Used by BOTH single and grid view: OUTPUT/SAVED are always the
    // formula ESTIMATE computed at each call site (pixel count x
    // effective bit depth x a fixed compression guess) -- this is the
    // editorial HUD reading Greenhouse has always shown, not a real
    // encoded size. Kept clamped (0 to 99.9%) as it always was, since
    // it's a rough heuristic, not a measured value. [ ADD TO PRESSED
    // EDITION ] computes this SAME estimate itself (see its handler
    // further down) so PAGE 4 always describes exactly what this HUD
    // shows, without needing to read the DOM or share mutable state.
    // estBytes is expressed in bytes so both this and
    // updateOrigAndPowerHUD() share the one formatSizeLabel() unit rule.
    function updateOutputHUDEstimate(origBytes, estBytes) {
        const hudSize = document.getElementById('hud-size');
        const hudSaved = document.getElementById('hud-saved');
        const hasData = origBytes && origBytes > 0;

        if (hudSize) hudSize.innerText = hasData ? formatSizeLabel(estBytes) : '—';

        if (hasData) {
            let savedPercent = ((origBytes - estBytes) / origBytes) * 100;
            if (savedPercent <= 0) savedPercent = 0;
            else if (savedPercent > 99.9) savedPercent = 99.9;
            if(hudSaved) hudSaved.innerText = `${savedPercent.toFixed(1)}%`;
        } else {
            if(hudSaved) hudSaved.innerText = '—';
        }
    }

    // --- 6. 事件監聽器 (滑桿、按鈕) ---
    if(btnGrid) {
        btnGrid.addEventListener('click', () => {
            state.isGridView = !state.isGridView;
            btnGrid.classList.toggle('highlight-bg');
            if (state.isGridView) {
                singleView.style.display = 'none';
                gridView.style.display = 'grid';
            } else {
                singleView.style.display = 'flex'; // 確保外層可見
                gridView.style.display = 'none';
            }
            renderCanvas();
        });
    }

    btnSplit.addEventListener('click', () => {
        state.isSplitMode = !state.isSplitMode;
        btnSplit.classList.toggle('highlight-bg');
        splitter.style.display = state.isSplitMode ? 'block' : 'none';
        renderCanvas();
    });

    btnInk.addEventListener('click', () => {
        state.isInvertMode = !state.isInvertMode;
        btnInk.classList.toggle('highlight-bg');
        renderCanvas();
    });

    btnOrigColor.addEventListener('click', () => {
        state.useOrigColor = !state.useOrigColor;
        btnOrigColor.classList.toggle('highlight-bg');
        renderCanvas();
    });

    function syncSlider(slider, display, stateKey) {
        slider.addEventListener('input', (e) => {
            state[stateKey] = parseInt(e.target.value);
            let suffix = stateKey === 'bitDepth' ? '-BIT' : '%';
            display.innerText = state[stateKey] + suffix;
            renderCanvas();
        });
    }
    syncSlider(sliderDownsample, displayDownsample, 'downsample');
    syncSlider(sliderBitDepth, displayBitDepth, 'bitDepth');
    syncSlider(sliderDither, displayDither, 'ditherLvl');

    selectAlgorithm.addEventListener('change', (e) => {
        state.algorithm = e.target.selectedIndex;
        renderCanvas();
    });

    const presets = [
        { name: 'GAMEBOY', downsample: 50, ditherLvl: 80, algo: 1, dark: [15,56,15], light: [155,188,15] },
        { name: 'E-INK', downsample: 100, ditherLvl: 100, algo: 0, dark: [30,30,30], light: [230,230,230] },
        { name: 'OLED', downsample: 100, ditherLvl: 60, algo: 2, dark: [0,0,0], light: [0,255,0] },
        { name: 'CRT_TV', downsample: 30, ditherLvl: 50, algo: 1, dark: [0,0,50], light: [255,200,200] }
    ];

    presetButtons.forEach((btn, index) => {
        btn.addEventListener('click', () => {
            presetButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const p = presets[index];
            sliderDownsample.value = state.downsample = p.downsample;
            sliderDither.value = state.ditherLvl = p.ditherLvl;
            selectAlgorithm.selectedIndex = state.algorithm = p.algo;
            state.palette = { dark: p.dark, light: p.light };

            displayDownsample.innerText = p.downsample + '%';
            displayDither.innerText = p.ditherLvl + '%';
            renderCanvas();
        });
    });

    let isDragging = false;
    splitter.addEventListener('mousedown', () => isDragging = true);
    document.addEventListener('mouseup', () => isDragging = false);
    document.addEventListener('mousemove', (e) => {
        if (!isDragging || !state.image || !state.isSplitMode) return;
        const rect = canvas.getBoundingClientRect();
        let x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percent = (x / rect.width) * 100;
        splitter.style.left = `${percent}%`;
        state.splitPos = 100 - percent;
        renderCanvas();
    });

    // --- 6b. 網路攝影機 (Webcam capture) ---
    function stopWebcam() {
        if (!webcamStream) return;

        webcamStream.getTracks().forEach((track) => track.stop());
        webcamStream = null;
        if (webcamPreview) webcamPreview.srcObject = null;
        if (btnWebcamCapture) btnWebcamCapture.disabled = true;
    }

    function showWebcamView() {
        isWebcamLive = true;
        if (webcamView) webcamView.hidden = false;
        hideEmptyState();
        updateInterfaceState(); // disables unrelated controls while the stream is live, whether or not images already exist
    }

    // Only flips the live-stream flag and hides the video UI. Deliberately
    // does NOT call updateInterfaceState() itself: captureWebcamFrame()
    // calls this before its async toBlob()/Image load resolves, and
    // addImageToLibrary() will call updateInterfaceState() once the
    // captured frame actually lands in the library a moment later. The
    // CANCEL handler calls updateInterfaceState() explicitly right after
    // this, since cancelling has no further async step to wait for.
    function hideWebcamView() {
        isWebcamLive = false;
        if (webcamView) webcamView.hidden = true;
    }

    function onWebcamReady() {
        if (!webcamStream) return; // stopped/cancelled before metadata arrived
        if (webcamPreview.videoWidth > 0 && webcamPreview.videoHeight > 0) {
            if (btnWebcamCapture) btnWebcamCapture.disabled = false;
        }
    }

    if (webcamPreview) {
        webcamPreview.addEventListener('loadedmetadata', onWebcamReady);
        webcamPreview.addEventListener('canplay', onWebcamReady);
    }

    // Single webcam implementation shared by both entry points (the
    // centred empty-state button and the right-side sidebar button) --
    // same camera state, same <video>, same capture/error/cleanup functions.
    async function startWebcam() {
        if (isWebcamLive) return;
        setEmptyStateError(null);

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setEmptyStateError('Webcam access is unavailable in this browser or context.');
            return;
        }

        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: 'user' }
                },
                audio: false
            });
        } catch (err) {
            console.error('[Greenhouse] getUserMedia failed:', err);
            if (err && err.name === 'NotAllowedError') {
                setEmptyStateError('Camera access was not allowed.');
            } else if (err && (err.name === 'NotFoundError' || err.name === 'OverconstrainedError' || err.name === 'DevicesNotFoundError')) {
                setEmptyStateError('No camera was found.');
            } else {
                setEmptyStateError('Webcam access is unavailable in this browser or context.');
            }
            return;
        }

        try {
            webcamStream = stream;
            if (btnWebcamCapture) btnWebcamCapture.disabled = true; // stays disabled until video reports real dimensions
            webcamPreview.srcObject = stream;
            showWebcamView();
        } catch (err) {
            console.error('[Greenhouse] failed to attach webcam stream:', err);
            stopWebcam(); // cleans up the partially-created stream
            setEmptyStateError('Webcam access is unavailable in this browser or context.');
        }
    }

    function pad2(n) { return String(n).padStart(2, '0'); }

    function captureWebcamFrame() {
        if (!webcamStream || !webcamPreview.videoWidth || !webcamPreview.videoHeight) return;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = webcamPreview.videoWidth;
        tempCanvas.height = webcamPreview.videoHeight;
        // Live preview is not mirrored (no CSS transform on #webcam-preview),
        // so the captured frame is drawn as-is and stays unmirrored too.
        tempCanvas.getContext('2d').drawImage(webcamPreview, 0, 0, tempCanvas.width, tempCanvas.height);

        stopWebcam();
        hideWebcamView();

        tempCanvas.toBlob((blob) => {
            if (!blob) {
                setEmptyStateError('Webcam access is unavailable in this browser or context.');
                showEmptyState();
                return;
            }

            const objectUrl = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
                const now = new Date();
                const name = `webcam-capture-${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}-${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}.jpg`;
                addImageToLibrary(img, blob.size, name);
                URL.revokeObjectURL(objectUrl);
            };
            img.src = objectUrl;
        }, 'image/jpeg', 0.92);
    }

    if (btnWebcamEmpty) {
        btnWebcamEmpty.addEventListener('click', () => {
            startWebcam();
        });
    }

    if (btnWebcamSidebar) {
        btnWebcamSidebar.addEventListener('click', () => {
            startWebcam();
        });
    }

    if (btnWebcamCancel) {
        btnWebcamCancel.addEventListener('click', () => {
            stopWebcam();
            hideWebcamView();
            // Returns to whichever state is actually correct: the empty
            // state if the library is still empty, or the existing image
            // preview (already untouched underneath) if images exist.
            updateInterfaceState();
        });
    }

    if (btnWebcamCapture) {
        btnWebcamCapture.addEventListener('click', () => {
            if (btnWebcamCapture.disabled) return;
            captureWebcamFrame();
        });
    }

    // Camera cleanup: never leave the stream running past its useful
    // moment. Covers page unload and, since the iframe is same-origin
    // and the parent never reloads it on close, the parent dialog's own
    // "close" event too (wrapped defensively so the tool still works
    // when loaded standalone, outside the dialog).
    window.addEventListener('pagehide', stopWebcam);
    window.addEventListener('beforeunload', stopWebcam);

    try {
        if (window.parent !== window) {
            const parentDialog = window.parent.document.getElementById('greenhouse-dialog');
            parentDialog?.addEventListener('close', stopWebcam);
        }
    } catch (error) {
        console.warn('Unable to attach parent dialog cleanup.', error);
    }

    // Initial page setup: the library starts empty, so this locks every
    // requires-image control and confirms the empty state is showing.
    updateInterfaceState();

    // --- 7. 微觀像素檢視器 (Zoom Lens) ---
    const lensCanvas = document.createElement('canvas');
    lensCanvas.id = 'zoom-lens';
    lensCanvas.width = 160;
    lensCanvas.height = 160;
    document.body.appendChild(lensCanvas);
    const lensCtx = lensCanvas.getContext('2d');

    let isZooming = false;
    let currentTargetCanvas = null;
    const ZOOM_FACTOR = 4;

    document.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'CANVAS' && e.target.id !== 'zoom-lens') {
            isZooming = true;
            currentTargetCanvas = e.target;
            lensCanvas.style.display = 'block';
            updateLens(e);
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (!isZooming || !currentTargetCanvas) return;
        updateLens(e);
    });

    document.addEventListener('mouseup', () => {
        isZooming = false;
        currentTargetCanvas = null;
        lensCanvas.style.display = 'none';
    });

    function updateLens(e) {
        const rect = currentTargetCanvas.getBoundingClientRect();
        const scale = Math.min(rect.width / currentTargetCanvas.width, rect.height / currentTargetCanvas.height);
        const renderedW = currentTargetCanvas.width * scale;
        const renderedH = currentTargetCanvas.height * scale;
        const offsetX = (rect.width - renderedW) / 2;
        const offsetY = (rect.height - renderedH) / 2;

        const internalX = (e.clientX - rect.left - offsetX) / scale;
        const internalY = (e.clientY - rect.top - offsetY) / scale;

        lensCanvas.style.left = (e.clientX + 15) + 'px';
        lensCanvas.style.top = (e.clientY + 15) + 'px';

        lensCtx.clearRect(0, 0, lensCanvas.width, lensCanvas.height);
        lensCtx.imageSmoothingEnabled = false;

        const sourceSize = lensCanvas.width / ZOOM_FACTOR;
        const sx = internalX - sourceSize / 2;
        const sy = internalY - sourceSize / 2;

        lensCtx.drawImage(
            currentTargetCanvas,
            sx, sy, sourceSize, sourceSize,
            0, 0, lensCanvas.width, lensCanvas.height
        );

        lensCtx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
        lensCtx.lineWidth = 1;
        lensCtx.beginPath();
        lensCtx.moveTo(lensCanvas.width / 2, 0);
        lensCtx.lineTo(lensCanvas.width / 2, lensCanvas.height);
        lensCtx.moveTo(0, lensCanvas.height / 2);
        lensCtx.lineTo(lensCanvas.width, lensCanvas.height / 2);
        lensCtx.stroke();
    }
    // ==========================================
    // --- 8. 輸出與匯出模組 (Export & Copy) ---
    // ==========================================

    // 匯出 WebP 圖片
    btnExport.addEventListener('click', () => {
        if (!state.image) {
            alert('[!] PLEASE IMPORT AN IMAGE FIRST.');
            return;
        }

        // 防呆：如果在網格模式，請使用者切換回單圖再下載
        if (state.isGridView) {
            alert('[!] PLEASE SWITCH TO SINGLE VIEW TO EXPORT.');
            return;
        }

        const link = document.createElement('a');
        link.download = `perma_texture_${Date.now()}.webp`;
        // 核心：將畫布轉換為 WebP 格式，並設定 0.8 的破壞性壓縮，貫徹降低頻寬浪費的哲學
        link.href = canvas.toDataURL('image/webp', 0.8);
        link.click();
    });

    // Send the currently visible processed result to the Pressed
    // Edition, together with the real Greenhouse metadata that produced
    // it (assets/js/pressed-edition-print.js's PAGE 4 [ IMAGE DATA ]
    // section reads this same record). This key must match pressed-
    // edition-print.js's PRESSED_EDITION_IMAGE_KEY and index.html's
    // live map, whichever page reads it next.
    //
    // sessionStorage (not localStorage): this is a single-visit
    // selection belonging to the current Garden session, not a
    // permanent preference -- matches assets/js/garden-return-flag.js's
    // same reasoning for the return-navigation flags.
    if (btnAddPressedEdition) {
        const PRESSED_EDITION_IMAGE_KEY = 'resilient-garden-pressed-edition-image';
        const DITHER_ALGORITHM_LABELS = ['Floyd–Steinberg', 'Bayer matrix', 'Random noise'];
        let statusTimeout = null;

        // state.origBytes is the uploaded File's own raw file.size (see
        // handleFiles() above), stored and passed through as-is, never
        // rounded to KB and converted back. outputBytes is the SAME
        // formula estimate the OUTPUT/SAVED HUD shows (not a real
        // encoded Blob size -- see updateOutputHUDEstimate() above and
        // the click handler below, which computes it fresh from the
        // canvas's current dimensions so it always matches what's on
        // screen at the moment of the click). state.image is the
        // original, un-downsampled Image element (so .width/.height
        // are the real source dimensions), and the rest come straight
        // from the actual IMAGE REDUCTION / DITHERING METHOD controls'
        // current values.
        function buildPressedEditionMetadata(outputBytes, outputWidth, outputHeight) {
            return {
                originalBytes: state.origBytes,
                outputBytes: outputBytes,
                originalWidth: state.image ? state.image.width : null,
                originalHeight: state.image ? state.image.height : null,
                outputWidth: outputWidth,
                outputHeight: outputHeight,
                parameters: {
                    downsample: state.downsample,
                    bitDepth: state.bitDepth,
                    ditherLevel: state.ditherLvl,
                    algorithm: DITHER_ALGORITHM_LABELS[state.algorithm] || null,
                    colourMode: state.useOrigColor ? 'Original colour' : 'Monochrome'
                }
            };
        }

        btnAddPressedEdition.addEventListener('click', () => {
            if (!state.image) {
                alert('[!] PLEASE IMPORT AN IMAGE FIRST.');
                return;
            }
            if (state.isGridView) {
                alert('[!] PLEASE SWITCH TO SINGLE VIEW TO ADD TO PRESSED EDITION.');
                return;
            }

            // The SAME estimate formula renderCanvas() just used to
            // paint OUTPUT/SAVED, evaluated fresh from the canvas's
            // current (already-processed) dimensions and the current
            // control values -- not a re-run of the whole pixel
            // pipeline, and not read back off the HUD's own DOM text --
            // so PAGE 4 always describes exactly what this HUD shows at
            // the moment of this click.
            const effectiveBitDepth = state.useOrigColor ? (state.bitDepth * 3) : state.bitDepth;
            const estOutputBytes = ((canvas.width * canvas.height) * (effectiveBitDepth / 8) * 0.15);
            const metadata = buildPressedEditionMetadata(estOutputBytes, canvas.width, canvas.height);

            // canvas.toBlob() here is only to produce the actual stored
            // WebP image (via FileReader below) -- its Blob.size is
            // never read for the metadata above, which is already
            // built from the estimate.
            canvas.toBlob((blob) => {
                if (!blob) {
                    if (pressedEditionAddStatus) {
                        pressedEditionAddStatus.textContent = '[!] COULD NOT ENCODE IMAGE.';
                    }
                    return;
                }

                const reader = new FileReader();

                reader.onload = () => {
                    const record = Object.assign({ image: reader.result }, metadata);

                    try {
                        sessionStorage.setItem(PRESSED_EDITION_IMAGE_KEY, JSON.stringify(record));
                    } catch (err) {
                        // Quota exceeded or storage unavailable -- tell the visitor
                        // rather than silently doing nothing.
                        if (pressedEditionAddStatus) {
                            pressedEditionAddStatus.textContent = '[!] COULD NOT SAVE -- STORAGE UNAVAILABLE.';
                        }
                        console.warn('[Greenhouse] Unable to store Pressed Edition image.', err);
                        return;
                    }

                    if (pressedEditionAddStatus) {
                        pressedEditionAddStatus.textContent = 'Added to Pressed Edition.';
                        if (statusTimeout) clearTimeout(statusTimeout);
                        statusTimeout = setTimeout(() => {
                            pressedEditionAddStatus.textContent = '';
                        }, 3000);
                    }
                };

                reader.readAsDataURL(blob);
            }, 'image/webp', 0.8);
        });
    }

});
