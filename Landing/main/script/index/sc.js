const canvas = document.getElementById("summaryCanvas");
const ctx = canvas.getContext("2d");

// High-DPI Resolution Monitor Correction
const pixelRatio = window.devicePixelRatio || 1;
const logicalWidth = 772;
const logicalHeight = 280;

canvas.width = logicalWidth * pixelRatio;
canvas.height = logicalHeight * pixelRatio;
ctx.scale(pixelRatio, pixelRatio);

// Core Layout Geometry Bounds Parameters
const padding = { top: 20, right: 30, bottom: 40, left: 60 };
const graphWidth = logicalWidth - padding.left - padding.right;
const graphHeight = logicalHeight - padding.top - padding.bottom;
const baselineY = padding.top + graphHeight;
const maxVal = 300000;

// Corrected Datasets (13 points for perfect Bezier flow)
const labels = ["May", "Jun", "Jul", "Aug", "Sep", "Oct"];
const rawCurrent = [
  255000, 132000, 255000, 142000, 175000, 128000, 235000, 222000, 250000,
  190000, 250000, 222000, 182000, 245000,
];
const rawPrevious = [
  112000, 152000, 185000, 142000, 225000, 185000, 155000, 118000, 125000,
  148000, 188000, 190000, 142000, 130000,
];
const totalPoints = rawCurrent.length;

// Points cache pools
const pointsCurrent = Array.from({ length: totalPoints }, () => ({
  x: 0,
  y: 0,
  val: 0,
}));
const pointsPrevious = Array.from({ length: totalPoints }, () => ({
  x: 0,
  y: 0,
  val: 0,
}));

// Grid Mapping Collections Caches
const yTicks = [0, 100000, 200000, 300000];
const cachedYGrid = yTicks.map(tick => ({
  y: padding.top + graphHeight - (tick / maxVal) * graphHeight,
  label: tick === 0 ? "$0.00" : `$${tick / 500}k`,
}));

const cachedXGrid = labels.map((label, idx) => {
  const targetIdx = Math.round((totalPoints - 1) * ((idx * 2 + 1) / 12));
  const x = padding.left + (targetIdx / (totalPoints - 1)) * graphWidth;
  return { x, label };
});

// Interactive Tracking & Animation State System
let animationProgress = 0;
const introDuration = 300;
let startTime = null;
let activeIndex = -1;

// NEW: Hover Interactivity Fluid Tracking State Cache
// These store variables that track our animated indicators across frames
const hoverAnim = {
  currentX: padding.left,
  currentBlueY: baselineY,
  currentGrayY: baselineY,
  opacity: 0, // Handles fading elements in and out smoothly
  targetX: padding.left,
  targetBlueY: baselineY,
  targetGrayY: baselineY,
  targetOpacity: 0,
  activeValBlue: 0,
  activeValGray: 0,
};

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

// Single-pass custom curve drawer
function drawCurvePath(points, tension = 0.15) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 === points.length ? i + 1 : i + 2];

    ctx.bezierCurveTo(
      p1.x + (p2.x - p0.x) * tension,
      p1.y + (p2.y - p0.y) * tension,
      p2.x - (p3.x - p1.x) * tension,
      p2.y - (p3.y - p1.y) * tension,
      p2.x,
      p2.y,
    );
  }
}

// Core Render and Continuous Fluid Animation System
function render(timestamp) {
  if (!startTime) startTime = timestamp;
  const elapsed = timestamp - startTime;

  // Handle initial intro sweep transition
  if (animationProgress < 1) {
    animationProgress = Math.min(elapsed / introDuration, 1);
  }

  const easeProgress = easeOutCubic(animationProgress);

  // Compute logical point maps
  for (let i = 0; i < totalPoints; i++) {
    const x = padding.left + (i / (totalPoints - 1)) * graphWidth;
    const targetYCurrent = baselineY - (rawCurrent[i] / maxVal) * graphHeight;
    const targetYPrevious = baselineY - (rawPrevious[i] / maxVal) * graphHeight;

    pointsCurrent[i].x = x;
    pointsCurrent[i].y =
      baselineY + (targetYCurrent - baselineY) * easeProgress;
    pointsCurrent[i].val = rawCurrent[i];

    pointsPrevious[i].x = x;
    pointsPrevious[i].y =
      baselineY + (targetYPrevious - baselineY) * easeProgress;
    pointsPrevious[i].val = rawPrevious[i];
  }

  // NEW HOVER ANIMATION ENGINE: Interpolate values using an ease-out velocity formula (0.18 factor)
  // This recalculates positions dynamically to ensure structural fluidity on every frame
  hoverAnim.currentX += (hoverAnim.targetX - hoverAnim.currentX) * 0.18;
  hoverAnim.currentBlueY +=
    (hoverAnim.targetBlueY - hoverAnim.currentBlueY) * 0.18;
  hoverAnim.currentGrayY +=
    (hoverAnim.targetGrayY - hoverAnim.currentGrayY) * 0.18;
  hoverAnim.opacity += (hoverAnim.targetOpacity - hoverAnim.opacity) * 0.15;

  ctx.clearRect(0, 0, logicalWidth, logicalHeight);

  // 1. Render Pre-Calculated Grid Lines & Axes Labels
  ctx.lineWidth = 1;
  ctx.font = "12px -apple-system, sans-serif";
  ctx.strokeStyle = "#f1f5f9";

  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#94a3b8";
  for (let i = 0; i < cachedYGrid.length; i++) {
    const tick = cachedYGrid[i];
    ctx.fillText(tick.label, padding.left - 15, tick.y);
    ctx.beginPath();
    ctx.moveTo(padding.left, tick.y);
    ctx.lineTo(padding.left + graphWidth, tick.y);
    ctx.stroke();
  }

  ctx.textAlign = "center";
  for (let i = 0; i < cachedXGrid.length; i++) {
    const node = cachedXGrid[i];
    ctx.beginPath();
    ctx.moveTo(node.x, padding.top);
    ctx.lineTo(node.x, padding.top + graphHeight);
    ctx.stroke();
    ctx.fillStyle = "#64748b";
    ctx.fillText(node.label, node.x, padding.top + graphHeight + 20);
  }

  // 2. Compute Fading Area Mask Fill Under Current Line
  ctx.save();
  drawCurvePath(pointsCurrent);
  ctx.lineTo(padding.left + graphWidth, baselineY);
  ctx.lineTo(padding.left, baselineY);
  ctx.closePath();

  const gradient = ctx.createLinearGradient(0, padding.top, 0, baselineY);
  gradient.addColorStop(0, "rgba(24, 102, 236, 0.22)");
  gradient.addColorStop(1, "rgba(24, 102, 236, 0.00)");
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.restore();

  // 3. Render Graph Curve Lines
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.strokeStyle = "#94a3b8";
  ctx.setLineDash([4, 4]); // Clean dashed styling parameters mapping
  drawCurvePath(pointsPrevious);
  ctx.stroke();

  ctx.strokeStyle = "#1866ec";
  ctx.setLineDash([]);
  drawCurvePath(pointsCurrent);
  ctx.stroke();

  // 4. Smooth Animated Interactive Overlays Passing Loop Conditions
  // Elements fade in/out and follow your mouse smoothly based on computed opacity metrics
  if (hoverAnim.opacity > 0.01) {
    ctx.save();
    ctx.globalAlpha = hoverAnim.opacity;

    // Moving crosshair guideline tracking bar
    ctx.beginPath();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
    ctx.lineWidth = 1;
    ctx.moveTo(hoverAnim.currentX, padding.top);
    ctx.lineTo(hoverAnim.currentX, baselineY);
    ctx.stroke();

    // Slideway tracking target nodes
    drawCircleNode(hoverAnim.currentX, hoverAnim.currentGrayY, "#94a3b8");
    drawCircleNode(hoverAnim.currentX, hoverAnim.currentBlueY, "#1866ec");

    // Dynamic text floating dialog window positioning panel
    drawFloatingTooltip(
      hoverAnim.currentX,
      hoverAnim.currentBlueY,
      hoverAnim.activeValBlue,
      hoverAnim.activeValGray,
    );

    ctx.restore();
  }

  // Keep the execution thread active so tracking transitions run smoothly
  requestAnimationFrame(render);
}

function drawCircleNode(x, y, strokeColor) {
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

function drawFloatingTooltip(exactX, bY, currentVal, priorVal) {
  const width = 110,
    height = 50;
  let x = exactX - width / 2;
  let y = bY - height - 12;

  if (x < padding.left) x = padding.left;
  if (x + width > logicalWidth - padding.right)
    x = logicalWidth - padding.right - width;
  if (y < padding.top) y = bY + 12;

  ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 6);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 12px -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`Current: $${(currentVal / 1000).toFixed(0)}k`, x + 8, y + 16);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "11px -apple-system, sans-serif";
  ctx.fillText(`Prior: $${(priorVal / 1000).toFixed(0)}k`, x + 8, y + 34);
}

// Interactive Tracking Events Listeners Layer
canvas.addEventListener("mousemove", e => {
  if (animationProgress < 1) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = logicalWidth / rect.width;
  const canvasMouseX = (e.clientX - rect.left) * scaleX;

  if (
    canvasMouseX >= padding.left &&
    canvasMouseX <= logicalWidth - padding.right
  ) {
    const index = Math.round(
      ((canvasMouseX - padding.left) / graphWidth) * (totalPoints - 1),
    );

    if (index !== activeIndex) {
      activeIndex = index;

      // Update hover interaction target positions
      // The core loop handles translating these values over multiple frames
      hoverAnim.targetX = pointsCurrent[index].x;
      hoverAnim.targetBlueY = pointsCurrent[index].y;
      hoverAnim.targetGrayY = pointsPrevious[index].y;
      hoverAnim.activeValBlue = pointsCurrent[index].val;
      hoverAnim.activeValGray = pointsPrevious[index].val;
      hoverAnim.targetOpacity = 1; // Smoothly fades elements in
    }
  } else {
    activeIndex = -1;
    hoverAnim.targetOpacity = 0; // Smoothly fades elements out when leaving data margins
  }
});

canvas.addEventListener("mouseleave", () => {
  activeIndex = -1;
  hoverAnim.targetOpacity = 0;
});

// Initialize Rendering Engine Loop
requestAnimationFrame(render);

// DOM Element Cache Selectors
const dateToggleField = document.getElementById("dateToggleField");
const timePickerField = document.getElementById("timePickerField");
const calendarMenu = document.getElementById("calendarMenu");
const timeMenu = document.getElementById("timeMenu");
const calendarDaysGrid = document.getElementById("calendarDaysGrid");
const calendarMonthTitle = document.getElementById("calendarMonthTitle");
const dateDisplayValue = document.getElementById("dateDisplayValue");
const timeDisplayValue = document.getElementById("timeDisplayValue");
const prevMonthBtn = document.getElementById("prevMonthBtn");
const nextMonthBtn = document.getElementById("nextMonthBtn");
const checkBtn = document.getElementById("checkBtn");

// Functional State Objects
let currentCalendarDate = new Date(2022, 10, 20);
let selectedCalendarDate = new Date(2022, 10, 20);
let selectedTime = "10 AM"; // Default matching image snapshot

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Generate list of 24 hours options
const timeSlots = [
  "12 AM",
  "1 AM",
  "2 AM",
  "3 AM",
  "4 AM",
  "5 AM",
  "6 AM",
  "7 AM",
  "8 AM",
  "9 AM",
  "10 AM",
  "11 AM",
  "12 PM",
  "1 PM",
  "2 PM",
  "3 PM",
  "4 AM",
  "5 PM",
  "6 PM",
  "7 PM",
  "8 PM",
  "9 PM",
  "10 PM",
  "11 PM",
];

// 1. Calendar Render Processing Pipeline
function drawCalendar() {
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();

  calendarMonthTitle.innerText = `${monthNames[month]} ${year}`;
  calendarDaysGrid.innerHTML = "";

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < firstDayIndex; i++) {
    const emptyCell = document.createElement("div");
    emptyCell.className = "calendar-day empty-cell";
    calendarDaysGrid.appendChild(emptyCell);
  }

  for (let day = 1; day <= totalDaysInMonth; day++) {
    const dayCell = document.createElement("div");
    dayCell.className = "calendar-day";
    dayCell.innerText = day;

    if (
      year === selectedCalendarDate.getFullYear() &&
      month === selectedCalendarDate.getMonth() &&
      day === selectedCalendarDate.getDate()
    ) {
      dayCell.classList.add("selected-date");
    }

    dayCell.addEventListener("click", () => {
      selectedCalendarDate = new Date(year, month, day);
      const options = { month: "short", day: "numeric", year: "numeric" };
      dateDisplayValue.innerText = selectedCalendarDate.toLocaleDateString(
        "en-US",
        options,
      );

      calendarMenu.classList.remove("is-open");
      dateToggleField.classList.remove("is-active-field");
      drawCalendar();
    });

    calendarDaysGrid.appendChild(dayCell);
  }
}

// NEW: 2. Time Menu Render Processing Pipeline
function drawTimeDropdown() {
  timeMenu.innerHTML = "";
  timeSlots.forEach(slot => {
    const option = document.createElement("div");
    option.className = "time-option";
    option.innerText = slot;

    if (slot === selectedTime) {
      option.classList.add("selected-time");
    }

    option.addEventListener("click", () => {
      selectedTime = slot;
      timeDisplayValue.innerText = slot;

      timeMenu.classList.remove("is-open");
      timePickerField.classList.remove("is-active-field");
      drawTimeDropdown(); // Refresh highlights
    });

    timeMenu.appendChild(option);
  });
}
dateToggleField.addEventListener("click", e => {
  e.stopPropagation();
  timeMenu.classList.remove("is-open");
  timePickerField.classList.remove("is-active-field");

  const isOpen = calendarMenu.classList.toggle("is-open");
  dateToggleField.classList.toggle("is-active-field", isOpen);
});
timePickerField.addEventListener("click", e => {
  e.stopPropagation();
  calendarMenu.classList.remove("is-open"); // Close opponent field
  dateToggleField.classList.remove("is-active-field");

  const isOpen = timeMenu.classList.toggle("is-open");
  timePickerField.classList.toggle("is-active-field", isOpen);
  if (isOpen) {
    const activeOption = timeMenu.querySelector(".selected-time");
    if (activeOption) {
      timeMenu.scrollTop = activeOption.offsetTop - timeMenu.offsetTop - 12;
    }
  }
});
prevMonthBtn.addEventListener("click", e => {
  e.stopPropagation();
  currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
  drawCalendar();
});

nextMonthBtn.addEventListener("click", e => {
  e.stopPropagation();
  currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
  drawCalendar();
});
document.addEventListener("click", () => {
  calendarMenu.classList.remove("is-open");
  timeMenu.classList.remove("is-open");
  dateToggleField.classList.remove("is-active-field");
  timePickerField.classList.remove("is-active-field");
});
checkBtn.addEventListener("click", () => {
  const dateOptions = { year: "numeric", month: "long", day: "numeric" };
  alert(
    `Checking availability for:\nDate: ${selectedCalendarDate.toLocaleDateString("en-US", dateOptions)}\nTime: ${selectedTime}`,
  );
});

// Initial Boot
drawCalendar();
drawTimeDropdown();

// LINE ANIMATION

document.addEventListener("DOMContentLoaded", () => {
  const loader = document.getElementById("loader-wrapper");
  const canvas = document.getElementById("neon-canvas");
  const ctx = canvas.getContext("2d");

  // Настройка адаптивного размера Canvas под экран
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  // Параметры для анимации волн
  let increment = 0;
  const waves = [
    {
      y: 0.5,
      length: 0.005,
      amplitude: 60,
      speed: 0.02,
      color: "rgba(0, 162, 255, 0.4)",
      glow: "#0077ff",
    },
    {
      y: 0.52,
      length: 0.003,
      amplitude: 40,
      speed: -0.015,
      color: "rgb(243, 241, 242)",
      glow: "#0044ff",
    }, 
    {
      y: 0.48,
      length: 0.004,
      amplitude: 50,
      speed: 0.01,
      color: "rgba(0, 38, 255, 0.62)",
      glow: "#0028ff",
    },
  ];

  // Функция отрисовки кадра
  function animateWaves() {
    // Если лоадер удален, останавливаем анимацию для экономии ресурсов
    if (!document.getElementById("loader-wrapper")) return;

    requestAnimationFrame(animateWaves);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Рисуем каждую волну из массива
    waves.forEach(wave => {
      ctx.beginPath();

      // Настройки неонового свечения линий на холсте
      ctx.shadowBlur = 15;
      ctx.shadowColor = wave.glow;
      ctx.strokeStyle = wave.color;
      ctx.lineWidth = 3;

      for (let i = 0; i < canvas.width; i++) {
        const yOffset =
          Math.sin(i * wave.length + increment * wave.speed) * wave.amplitude;
        // Располагаем волну по центру экрана с небольшим смещением (wave.y)
        const yPosition = canvas.height * wave.y + yOffset;

        if (i === 0) {
          ctx.moveTo(i, yPosition);
        } else {
          ctx.lineTo(i, yPosition);
        }
      }
      ctx.stroke();
    });

    increment += 1;
  }

  // Запуск анимации canvas
  animateWaves();

  // Фиксированный таймер работы экрана на 1 минуту (60000 мс)
  setTimeout(() => {
    loader.classList.add("loaded");
    setTimeout(() => loader.remove(), 600);
  }, 7000);
});
