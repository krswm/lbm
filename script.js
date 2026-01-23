// Occupation number at the equilibrium
function eq(W, ex, ey, ux, uy, uu) {
  const eu = (ex * ux + ey * uy);
  return W * (1 + 3 * eu + 4.5 * eu ** 2 - 1.5 * uu);
}

class Simulator {
  constructor() {
    this.canvas = document.getElementById("canvas");
    this.context = this.canvas.getContext("2d");

    this.stepP = document.getElementById("stepP");
  }

  initialize() {
    // Occupation Numbers
    //
    //         ||
    //         ||
    //      mm zm pm
    // ==== mz zz pz ===> x
    //      mp zp pp
    //         ||
    //         \/ y
    //
    // m stands for -1 (minus one)
    // z stands for 0 (zero)
    // p stands for +1 (plus one)
    this.zz = [];
    this.pz = [];
    this.mz = [];
    this.zp = [];
    this.zm = [];
    this.pp = [];
    this.mm = [];
    this.pm = [];
    this.mp = [];

    // Physical properties
    this.rho = [];  // Density
    this.ux = [];  // Velocity x component
    this.uy = [];  // Velocity y component
    this.uu = [];  // Speed squared
    this.curl = [];  // Curl of velocity

    this.is_wall = [];

    this.height = document.getElementById("heightInput").valueAsNumber;
    this.width = document.getElementById("widthInput").valueAsNumber;
    this.wallShape = document.getElementById("wallShape").value;
    this.drawMethod = document.getElementById("drawMethod").value;
    this.canvas.height = this.height;
    this.canvas.width = this.width;
    this.canvas.style.height = `${this.height * 4}px`;
    this.canvas.style.width = `${this.width * 4}px`;

    const probeX = document.getElementById("probeXInput").valueAsNumber;
    const probeY = document.getElementById("probeYInput").valueAsNumber;
    this.probeI = probeX + probeY * this.width;

    this.viscosity = document.getElementById("viscosityInput").valueAsNumber;
    this.omega = 1 / (0.5 + this.viscosity);

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.zz.push(0);
        this.pz.push(0);
        this.mz.push(0);
        this.zp.push(0);
        this.zm.push(0);
        this.pp.push(0);
        this.mm.push(0);
        this.pm.push(0);
        this.mp.push(0);

        this.rho.push(0);
        this.ux.push(0);
        this.uy.push(0);
	this.curl.push(0);

        this.is_wall.push(false);
      }
    }

    const wall_x = document.getElementById("wallXInput").valueAsNumber;
    const wall_y = document.getElementById("wallYInput").valueAsNumber;
    this.wallDiameter = (
      document.getElementById("wallDiameterInput").valueAsNumber
    );
    const wallRadius = this.wallDiameter / 2;

    this.rho0 = 1;
    this.ux0 = document.getElementById("speedInput").valueAsNumber;
    const uu0 = this.ux0 ** 2;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const i = x + y * this.width;
        this.rho[i] = this.rho0;
        this.ux[i] = this.ux0;

        this.zp[i] = eq(this.rho0 /  9,  0,  1, this.ux0, 0, uu0);
        this.zm[i] = eq(this.rho0 /  9,  0, -1, this.ux0, 0, uu0);
        this.pz[i] = eq(this.rho0 /  9,  1,  0, this.ux0, 0, uu0);
        this.mz[i] = eq(this.rho0 /  9, -1,  0, this.ux0, 0, uu0);
        this.pp[i] = eq(this.rho0 / 36,  1,  1, this.ux0, 0, uu0);
        this.mm[i] = eq(this.rho0 / 36, -1, -1, this.ux0, 0, uu0);
        this.pm[i] = eq(this.rho0 / 36,  1, -1, this.ux0, 0, uu0);
        this.mp[i] = eq(this.rho0 / 36, -1,  1, this.ux0, 0, uu0);

        this.zz[i] = (
          this.rho0
          - this.zp[i] - this.zm[i] - this.pz[i] - this.mz[i]
          - this.pp[i] - this.mm[i] - this.pm[i] - this.mp[i]
        );

        this.uy[i] = 0;

        if (this.wallShape === "circle") {
          if ((x - wall_x) ** 2 + (y - wall_y) ** 2 < wallRadius ** 2) {
            this.is_wall[x + y * this.width] = true;
          }
        } else if (this.wallShape === "bar") {
          if (
	    x === wall_x
	    && y >= wall_y - wallRadius
	    && y < wall_y + wallRadius
	  ) {
            this.is_wall[x + y * this.width] = true;
          }
        } else if (this.wallShape === "square") {
          if (
	    x >= wall_x - wallRadius
	    && x < wall_x + wallRadius
	    && y >= wall_y - wallRadius
	    && y < wall_y + wallRadius
	  ) {
            this.is_wall[x + y * this.width] = true;
          }
        }
      }
    }

    this.step = 0;
    this.csv = "step,curl,ux,uy,u,rho\n";
    this.maxStep = document.getElementById("maxStepInput").valueAsNumber;
    this.isBeforeMaxStep = true;
    this.exportButton = document.getElementById("exportButton");
    this.exportButton.disabled = true;
    this.exportButton.innerText = "観測中…";

    this.Re = this.rho0 * this.ux0 * (2 * wallRadius) / this.viscosity
    document.getElementById("reynoldsP").innerHTML = `${this.Re}`;
  }

  nextStep() {
    for (let trial = 0; trial < 25; trial++) {
      if (this.isBeforeMaxStep) {
	if (this.step >= this.maxStep) {
	  this.exportButton.disabled = false;
	  this.exportButton.innerText = "観測結果をCSVでダウンロード";
	  this.isBeforeMaxStep = false;
	} else {
	  this.csv += (
	    `${this.step},`
	    + `${this.curl[this.probeI]},`
	    + `${this.ux[this.probeI]},`
	    + `${this.uy[this.probeI]},`
	    + `${Math.sqrt(this.uu[this.probeI])},`
	    + `${this.rho[this.probeI]}\n`
	  );
	}
      }

      simulator.stream();
      simulator.bounce();
      simulator.collide();

      this.step += 25;
    }
    simulator.draw();
    this.stepP.innerHTML = `${this.step}`;
  }

  stream() {
    // Be careful at in what order to update the ocupation numbers!
    for (let y = this.height - 2; y >= 1; y--) {
      for (let x = this.width - 2; x >= 1; x--) {
        this.pz[x + y * this.width] = this.pz[(x - 1) + (y    ) * this.width];
        this.pp[x + y * this.width] = this.pp[(x - 1) + (y - 1) * this.width];
      }
      for (let x = 1; x <= this.width - 2; x++) {
        this.zp[x + y * this.width] = this.zp[(x    ) + (y - 1) * this.width];
        this.mp[x + y * this.width] = this.mp[(x + 1) + (y - 1) * this.width];
      }
    }
    for (let y = 1; y <= this.height - 2; y++) {
      for (let x = 1; x <= this.width - 2; x++) {
        this.mz[x + y * this.width] = this.mz[(x + 1) + (y    ) * this.width];
        this.mm[x + y * this.width] = this.mm[(x + 1) + (y + 1) * this.width];
      }
      for (let x = this.width - 2; x >= 1; x--) {
        this.zm[x + y * this.width] = this.zm[(x    ) + (y + 1) * this.width];
        this.pm[x + y * this.width] = this.pm[(x - 1) + (y + 1) * this.width];
      }
    }
  }

  bounce() {
    for (let y = 2; y <= this.height - 3; y++) {
      for (let x = 2; x <= this.width - 3; x++) {
        if (!this.is_wall[x + y * this.width]) {
          continue;
        }

        this.zp[(x    ) + (y + 1) * this.width] = this.zm[x + y * this.width];
        this.zm[(x    ) + (y - 1) * this.width] = this.zp[x + y * this.width];
        this.pz[(x + 1) + (y    ) * this.width] = this.mz[x + y * this.width];
        this.mz[(x - 1) + (y    ) * this.width] = this.pz[x + y * this.width];
        this.pp[(x + 1) + (y + 1) * this.width] = this.mm[x + y * this.width];
        this.mm[(x - 1) + (y - 1) * this.width] = this.pp[x + y * this.width];
        this.pm[(x + 1) + (y - 1) * this.width] = this.mp[x + y * this.width];
        this.mp[(x - 1) + (y + 1) * this.width] = this.pm[x + y * this.width];

        this.zz[x + y * this.width] = 0;
        this.zp[x + y * this.width] = 0;
        this.zm[x + y * this.width] = 0;
        this.pz[x + y * this.width] = 0;
        this.mz[x + y * this.width] = 0;
        this.pp[x + y * this.width] = 0;
        this.mm[x + y * this.width] = 0;
        this.pm[x + y * this.width] = 0;
        this.mp[x + y * this.width] = 0;
      }
    }
  }

  collide() {
    for (let y = 1; y <= this.height - 2; y++) {
      for (let x = 1; x <= this.width - 2; x++) {
        const i = x + y * this.width;

        if (this.is_wall[i]) {
          continue;
        }

        this.rho[i] = (
          this.zz[i]
          + this.zp[i] + this.zm[i] + this.pz[i] + this.mz[i]
          + this.pp[i] + this.mm[i] + this.pm[i] + this.mp[i]
        );

        // Discard the case where rho < 0.
        // Prevent dividing by 0 thus rho > 1e-6.
        if (this.rho[i] > 1e-6) {
          this.ux[i] = (
              this.pm[i] + this.pz[i] + this.pp[i]
            - this.mm[i] - this.mz[i] - this.mp[i]
          ) / this.rho[i];
          this.uy[i] = (
              this.mp[i] + this.zp[i] + this.pp[i]
            - this.mm[i] - this.zm[i] - this.pm[i]
          ) / this.rho[i];
	  this.uu[i] = this.ux[i] ** 2 + this.uy[i] ** 2;
        }

        this.update(this.rho[i], this.ux[i], this.uy[i], this.uu[i], i);

	this.curl[i] = (
	    this.uy[(y    ) * this.width + (x + 1)]
	  - this.ux[(y + 1) * this.width + (x    )]
	  - this.uy[(y    ) * this.width + (x - 1)]
	  + this.ux[(y - 1) * this.width + (x    )]
	);
      }
    }
  }

  update(rho, ux, uy, uu, i) {
    this.zp[i] += this.omega * (eq(rho /  9,  0,  1, ux, uy, uu) - this.zp[i]);
    this.zm[i] += this.omega * (eq(rho /  9,  0, -1, ux, uy, uu) - this.zm[i]);
    this.pz[i] += this.omega * (eq(rho /  9,  1,  0, ux, uy, uu) - this.pz[i]);
    this.mz[i] += this.omega * (eq(rho /  9, -1,  0, ux, uy, uu) - this.mz[i]);
    this.pp[i] += this.omega * (eq(rho / 36,  1,  1, ux, uy, uu) - this.pp[i]);
    this.mm[i] += this.omega * (eq(rho / 36, -1, -1, ux, uy, uu) - this.mm[i]);
    this.pm[i] += this.omega * (eq(rho / 36,  1, -1, ux, uy, uu) - this.pm[i]);
    this.mp[i] += this.omega * (eq(rho / 36, -1,  1, ux, uy, uu) - this.mp[i]);

    this.zz[i] = (
      rho
      - this.zp[i] - this.zm[i] - this.pz[i] - this.mz[i]
      - this.pp[i] - this.mm[i] - this.pm[i] - this.mp[i]
    )
  }

  draw() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const i = x + y * this.width;

        if (isNaN(this.rho[i])) {
          this.context.fillStyle = "lime";
        } else if (this.is_wall[i]) {
          this.context.fillStyle = "gray";
	} else if (i === this.probeI) {
	  this.context.fillStyle = "white";
        } else if (this.drawMethod === "curl") {
          if (this.curl[i] >= 0) {
            const l = Math.min(this.curl[i] * 1000, 100);
	    this.context.fillStyle = `oklch(${l}% 100% 0deg)`;
          } else {
            const l = Math.min(-this.curl[i] * 1000, 100);
	    this.context.fillStyle = `oklch(${l}% 100% 180deg)`;
          }
        } else if (this.drawMethod === "velocity") {
          const absu = Math.sqrt(this.uu[i] ** 2);
          const theta = Math.atan2(this.uy[i], this.ux[i]);x

          const l = absu * 200;
          const h = theta * 180 / Math.PI + 270;
          this.context.fillStyle = `oklch(${l}% 100% ${h}deg)`;
        } else if (this.drawMethod === "density") {
          const c = Math.min(Math.max((this.rho[i] - 1) * 3000 + 128, 0), 255);
          this.context.fillStyle = `rgb(${c} ${c} ${c})`;
        }

        this.context.fillRect(x, y, 1, 1);
      }
    }
  }

  export() {
    const exportA = document.getElementById("exportA");
    const blob = new Blob([this.csv], {type: "text/csv"});
    const url = window.URL.createObjectURL(blob);
    exportA.href = url;
    exportA.download = (
      "lbm_"
      + `${this.wallShape}_`
      + `μ=${this.viscosity}_`
      + `U=${this.ux0}_`
      + `ρ=${this.rho0}_`
      + `L=${this.wallDiameter}_`
      + `Re=${this.Re}`
      + ".csv"
    );
    exportA.click();
  }
}

const simulator = new Simulator();
simulator.initialize();
let interval = undefined;

const toggleButton = document.getElementById("toggleButton");

function onResetButtonClick() {
  simulator.initialize();
  clearInterval(interval);
  interval = setInterval(simulator.nextStep.bind(simulator), 50);
  toggleButton.innerText = "停止";
}

function onToggleButtonClick() {
  if (interval === undefined) {
    interval = setInterval(simulator.nextStep.bind(simulator), 50);
    toggleButton.innerText = "停止";
  } else {
    clearInterval(interval);
    interval = undefined;
    toggleButton.innerText = "再生";
  }
}

interval = setInterval(simulator.nextStep.bind(simulator), 50);
toggleButton.innerText = "停止";

function onCanvasMouseMove(element, event) {
  const rectangle = canvas.getBoundingClientRect();
  const x = Math.floor((event.clientX - rectangle.left) / 4);
  const y = Math.floor((event.clientY - rectangle.top) / 4);
  document.getElementById("mouseP").innerText = `(${x}, ${y})`;
}

// I began to write this file as a hobby project.
// I did not use any AI tools to write this file.
