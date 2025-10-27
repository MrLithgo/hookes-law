document.addEventListener("DOMContentLoaded", function () {
  // Elements
  const springContainer = document.getElementById("spring-container");
  const springZigzag = document.getElementById("spring-zigzag");
  const rubberBand = document.getElementById("rubber-band");
  const massContainer = document.getElementById("mass-container");
  const massCount = document.getElementById("mass-count");
  const massStack = document.getElementById("mass-stack");
  const massDisplay = document.getElementById("mass-display");
  const addMassBtn = document.getElementById("add-mass");
  const removeMassBtn = document.getElementById("remove-mass");
  const materialToggle = document.getElementById("material-toggle");
  const materialLabel = document.getElementById("material-label");
  const springOptions = document.querySelectorAll(".spring-option");
  const springOptionsContainer = document.getElementById("spring-options");
  const resetButton = document.getElementById("reset");
  const ruler = document.getElementById('ruler');
  const rulerScale = document.getElementById('ruler-scale') || createRulerScale();
  const recordButton = document.getElementById("record-btn");
  const extensionInput = document.getElementById("extension-input");
  const resultsTable = document.getElementById("results-table");
  const noResultsMessage = document.getElementById("no-results-message");
  const simulationContainer = document.getElementById("simulation-container");
const RUBBER_BAND_CONSTANTS = {
  initialStiffness: 0.3,   // N/cm (softer at start)
  stiffeningFactor: 0.05,   // How quickly it stiffens
  maxExtension: 100,       // cm (before breaking)
  hysteresisFactor: 0.7,   // 70% of energy returned
  startHeight: 180          // Match your spring's start height
};
  // Spring configurations
  const SPRING_CONFIGS = {
    25: { segments: 30, amplitude: 28, startHeight: 100 }, // Soft
    50: { segments: 40, amplitude: 28, startHeight: 80 },  // Medium
    75: { segments: 50, amplitude: 28, startHeight: 60 }   // Stiff
  };

  // State variables
  let currentMaterial = "spring";
  let currentSpringConstant = 25;
  let currentMasses = 0;
  let actualExtension = 0;
  
  // Constants
  const MAX_MASSES = 5;
  const GRAVITY = 10;
  const MASS_WEIGHT = 50;
  const CM_PER_NEWTON = 25;
  const MAX_EXTENSION_SPRING = 500;
  const MAX_EXTENSION_RUBBER = 120;
  const VISUAL_SCALE_FACTOR = 10;

  // Initialize spring path
  const springPath = document.getElementById("spring-path") || 
    (() => {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.id = "spring-path";
      path.setAttribute("stroke", "#2C3E50");
      path.setAttribute("stroke-width", "1.5");
      path.setAttribute("fill", "none");
      springZigzag.appendChild(path);
      return path;
    })();

  // Ruler functions
  function createRulerScale() {
    const scale = document.createElement('div');
    scale.id = 'ruler-scale';
    ruler.appendChild(scale);
    return scale;
  }

  function createRealisticRuler() {
    rulerScale.innerHTML = '';
    const heightPx = 370; // Keep your original height
    const totalCm = 30;
    const pxPerCm = heightPx / totalCm;
    
    for (let cm = 0; cm <= totalCm; cm++) {
        const position = cm * pxPerCm;
        const mark = document.createElement('div');
        mark.className = 'cm-mark';
        mark.style.top = `${position}px`;
        
        if (cm % 10 === 0) {
            // Major marks (every 10cm) - longest
            mark.style.height = '2px';
            mark.style.width = '18px';
            mark.style.background = '#111';
            
            const number = document.createElement('div');
            number.className = 'cm-number';
            number.style.top = `${position}px`;
            number.textContent = cm;
            rulerScale.appendChild(number);
        } 
        else if (cm % 5 === 0) {
            // Medium marks (every 5cm) - longer than 1cm but shorter than 10cm
            mark.style.height = '1.5px';
            mark.style.width = '12px';  // 5cm marks are wider than 1cm marks
        }
        else {
            // Minor marks (every 1cm) - shortest
            mark.style.height = '1px';
            mark.style.width = '8px';
        }
        
        rulerScale.appendChild(mark);
    }
}

  function startDragRuler(e) {
    e.preventDefault();
    const pos = e.touches ? {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    } : {
      x: e.clientX,
      y: e.clientY
    };
    
    const startX = pos.x;
    const startY = pos.y;
    const startLeft = parseInt(ruler.style.left) || 0;
    const startTop = parseInt(ruler.style.top) || 0;

    function moveRuler(e) {
      const currentPos = e.touches ? {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      } : {
        x: e.clientX,
        y: e.clientY
      };
      
      let newLeft = startLeft + (currentPos.x - startX);
      let newTop = startTop + (currentPos.y - startY);

      // Constrain to container
      newLeft = Math.max(0, Math.min(
        simulationContainer.clientWidth - ruler.offsetWidth,
        newLeft
      ));
      newTop = Math.max(0, Math.min(
        simulationContainer.clientHeight - ruler.offsetHeight,
        newTop
      ));

      ruler.style.left = `${newLeft}px`;
      ruler.style.top = `${newTop}px`;
    }

    function stopMoving() {
      document.removeEventListener('mousemove', moveRuler);
      document.removeEventListener('mouseup', stopMoving);
      document.removeEventListener('touchmove', moveRuler);
      document.removeEventListener('touchend', stopMoving);
    }

    document.addEventListener('mousemove', moveRuler);
    document.addEventListener('mouseup', stopMoving);
    document.addEventListener('touchmove', moveRuler, { passive: false });
    document.addEventListener('touchend', stopMoving);
  }

  function initializeRuler() {
    // Position ruler on right side, centered vertically
    ruler.style.position = 'absolute';
    ruler.style.left = `${simulationContainer.clientWidth - 50}px`;
    ruler.style.top = `${(simulationContainer.clientHeight - 300) / 2}px`;
    
    createRealisticRuler();
    
    // Set up drag events
    ruler.addEventListener('mousedown', startDragRuler);
    ruler.addEventListener('touchstart', startDragRuler, { passive: false });
  }

  // Spring functions
  function createSpringPath(height) {
    const config = SPRING_CONFIGS[currentSpringConstant] || SPRING_CONFIGS[25];
    if (!config) return;

    const segmentHeight = height / config.segments;
    let pathData = `M ${28} 0`;

    for (let i = 0; i < config.segments; i++) {
      const y = i * segmentHeight;
      pathData += i % 2 === 0
        ? ` L ${28 - config.amplitude} ${y + segmentHeight/2}`
        : ` L ${28 + config.amplitude} ${y + segmentHeight/2}`;
    }
    
    pathData += ` L ${28} ${height}`;
    springPath.setAttribute("d", pathData);
  }
  
  function calculateRubberBandExtension(masses, isUnloading) {
  const mass = masses * MASS_WEIGHT;
  const force = (mass / 1000) * GRAVITY;
  
  // J-curve formula
  let extension = (Math.sqrt(
    2 * RUBBER_BAND_CONSTANTS.initialStiffness * force + 
    Math.pow(RUBBER_BAND_CONSTANTS.stiffeningFactor * force, 2)
  ) - RUBBER_BAND_CONSTANTS.initialStiffness) / 
  RUBBER_BAND_CONSTANTS.stiffeningFactor;

  // Hysteresis effect
  if (isUnloading) {
    extension *= RUBBER_BAND_CONSTANTS.hysteresisFactor;
  }

  return Math.min(extension, RUBBER_BAND_CONSTANTS.maxExtension);
}

  function updateMassDisplay(masses) {
  // Get DOM elements
  const massHook = document.getElementById("mass-hook");
  const massStack = document.getElementById("mass-stack");
  const additionalMasses = document.getElementById("additional-masses");
  const massDisplay = document.getElementById("mass-display");

  // Toggle visibility
  if (masses > 0) {
    massHook.classList.remove("hidden");
    massStack.classList.remove("hidden");
  } else {
    massHook.classList.add("hidden");
    massStack.classList.add("hidden");
  }

  // Update additional masses
  additionalMasses.innerHTML = '';
  for (let i = 1; i < masses; i++) {
    const mass = document.createElement("div");
    mass.className = "additional-mass";
    additionalMasses.appendChild(mass);
  }

  // Update mass counter
  massDisplay.textContent = `${masses} × 100g masses`;

  // Update button states
  const removeMassBtn = document.getElementById("remove-mass");
  const addMassBtn = document.getElementById("add-mass");
  
  removeMassBtn.disabled = masses <= 0;
  removeMassBtn.classList.toggle("opacity-50", masses <= 0);
  removeMassBtn.classList.toggle("cursor-not-allowed", masses <= 0);

  addMassBtn.disabled = masses >= MAX_MASSES;
  addMassBtn.classList.toggle("opacity-50", masses >= MAX_MASSES);
  addMassBtn.classList.toggle("cursor-not-allowed", masses >= MAX_MASSES);
}
  
  
  function updateExtension(masses) {
  const isUnloading = masses < currentMasses;
  let extension;

  if (currentMaterial === "spring") {
    // Spring calculation
    const force = (masses * MASS_WEIGHT / 1000) * GRAVITY;
    extension = force * (CM_PER_NEWTON * (10 / currentSpringConstant));
    const visualExtension = extension * VISUAL_SCALE_FACTOR;
    
    const config = SPRING_CONFIGS[currentSpringConstant];
    springContainer.style.height = `${config.startHeight + visualExtension}px`;
    createSpringPath(config.startHeight + visualExtension);
  } else {
    // Rubber band calculation
    extension = calculateRubberBandExtension(masses, isUnloading);
    const visualExtension = extension * VISUAL_SCALE_FACTOR;
    rubberBand.style.height = `${RUBBER_BAND_CONSTANTS.startHeight + visualExtension}px`;
    rubberBand.style.borderWidth = `${Math.max(1, 3 - extension / 50)}px`;
  }

  // Update state and display
  currentMasses = masses;
  actualExtension = extension;
  updateMassDisplay(masses); // Now using our new function
}

  function toggleMaterial() {
    if (materialToggle.checked) {
      currentMaterial = "rubber";
      springContainer.classList.add("hidden");
      rubberBand.classList.remove("hidden");
      materialLabel.textContent = "Rubber Band";
      materialLabel.classList.remove("bg-teal", "bg-opacity-20");
      materialLabel.classList.add("bg-coral", "bg-opacity-20");
      springOptionsContainer.classList.add("hidden");
    } else {
      currentMaterial = "spring";
      springContainer.classList.remove("hidden");
      rubberBand.classList.add("hidden");
      materialLabel.textContent = "Spring";
      materialLabel.classList.remove("bg-coral", "bg-opacity-20");
      materialLabel.classList.add("bg-teal", "bg-opacity-20");
      springOptionsContainer.classList.remove("hidden");
    }
    updateExtension(currentMasses);
  }

  function recordResult() {
    const measuredExtension = parseFloat(extensionInput.value);

    if (isNaN(measuredExtension) || measuredExtension < 0) {
      alert("Please enter a valid extension measurement");
      return;
    }

    const force = (((currentMasses * MASS_WEIGHT*2) / 1000) * GRAVITY).toFixed(0);
    let material = currentMaterial === "spring" ? "Spring" : "Rubber Band";

    if (currentMaterial === "spring") {
      material += ` (k=${currentSpringConstant})`;
    }

    noResultsMessage.style.display = "none";

    const row = document.createElement("tr");
row.className = "table-row row-bordered";
row.innerHTML = `
  <td class="cell cell-left">${material}</td>
  <td class="cell cell-center">${currentMasses*0.1}</td>
  <td class="cell cell-center">${force}</td>
  <td class="cell cell-center">${measuredExtension.toFixed(1)}</td>
  <td class="cell cell-center">
    <button class="btn delete-btn coral-btn small-btn">Delete</button>
  </td>
`;

    resultsTable.appendChild(row);

    row.querySelector(".delete-btn").addEventListener("click", function () {
      row.remove();
      if (resultsTable.children.length === 0) {
        noResultsMessage.style.display = "block";
      }
    });

    extensionInput.value = "";
  }

  // Initialize everything
  function initializeSimulation() {
    const initialHeight = SPRING_CONFIGS[currentSpringConstant].startHeight;
    springContainer.style.height = `${initialHeight}px`;
    springContainer.classList.remove("hidden");
    rubberBand.classList.add("hidden");
    createSpringPath(initialHeight);
    
    initializeRuler();
    updateExtension(0);
  }

  // Event Listeners
  addMassBtn.addEventListener("click", function () {
    if (currentMasses < MAX_MASSES) {
      updateExtension(currentMasses + 1);
    }
  });

  removeMassBtn.addEventListener("click", function () {
    if (currentMasses > 0) {
      updateExtension(currentMasses - 1);
    }
  });

  springOptions.forEach((option) => {
    option.addEventListener("click", function () {
      currentSpringConstant = parseInt(this.dataset.k);
      springOptions.forEach((opt) => opt.classList.remove("selected"));
      this.classList.add("selected");
      updateExtension(currentMasses);
    });
  });

  materialToggle.addEventListener("change", toggleMaterial);

  resetButton.addEventListener("click", function () {
    updateExtension(0);
    materialToggle.checked = false;
    toggleMaterial();
    extensionInput.value = "";
    currentSpringConstant = 10;
    springOptions.forEach((opt) => opt.classList.remove("selected"));
    springOptions[0].classList.add("selected");
  });

  recordButton.addEventListener("click", recordResult);

  extensionInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      recordResult();
    }
  });

  // Start the simulation
  initializeSimulation();
});