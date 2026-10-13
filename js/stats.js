var SIM = SIM || {}

SIM.STATS = {

    init: function () {
        var view = this;
        view.variables();
        view.events();
    },

    variables: function () {
        var view = this;
        view.body = $('body');
        view.stats = view.body.find('section.stats');
        view.dmg = view.stats.find('.container-dmg canvas');
        view.dmglegend = view.stats.find('.container-dmg').siblings('.legend');
        view.aura = view.stats.find('.container-aura canvas');
        view.spread = view.stats.find('.container-spread canvas');
        view.colors = ['#003f5c', '#2f4b7c', '#665191', '#a05195', '#d45087', '#f95d6a', '#ff7c43', '#ffa600'];
        view.close = view.stats.find('.btn-close');
        view.table = view.stats.find('.container-table');
    },

    events: function () {
        var view = this;

        view.close.click(function (e) {
            e.preventDefault();
            $('.js-stats').removeClass('active');
            $('section.stats').removeClass('active');
            view.body.addClass('sidebar-mobile-open');
        });
    },

    initCharts: function (sim) {
        var view = this;
        $('.js-stats').removeClass('disabled');
        view.buildTable(sim);
        view.buildData(sim);
        view.buildAuras();
        view.buildDamage();
        view.buildSpread();
    },

    buildData: function (sim) {
        var view = this;

        // Auras
        let counter = 0;
        let data = [];
        let colors = [];
        view.auradata = {
            labels: [],
            datasets: []
        };
        for (let name in sim.player.auras) {
            let aura = sim.player.auras[name];
            if (!aura.uptime) continue;
            view.auradata.labels.push(aura.name);
            data.push(Math.min((aura.uptime / sim.totalduration / 10).toFixed(2), 100));
            colors.push(view.colors[counter % view.colors.length]);
            counter++;
        }
        view.auradata.datasets.push({
            data: data,
            fill: false,
            backgroundColor: colors,
        });

        // Damage
        counter = 0;
        data = [];
        colors = [];
        view.dmgdata = {
            labels: [],
            datasets: []
        };
        for (let name in sim.player.spells) {
            let spell = sim.player.spells[name];
            if (!spell.totaldmg) continue;
            view.dmgdata.labels.push(spell.name);
            data.push((spell.totaldmg / sim.totalduration).toFixed(2));
            colors.push(view.colors[counter % view.colors.length]);
            counter++;
        }

        // MH
        view.dmgdata.labels.push('Main Hand');
        data.push((sim.player.mh.totaldmg / sim.totalduration).toFixed(2));
        colors.push(view.colors[counter % view.colors.length]);
        counter++;
        if (sim.player.mh.totalprocdmg) {
            view.dmgdata.labels.push('Main Hand Proc');
            data.push((sim.player.mh.totalprocdmg / sim.totalduration).toFixed(2));
            colors.push(view.colors[counter % view.colors.length]);
            counter++;
        }

        // OH
        if (sim.player.oh) {
            view.dmgdata.labels.push('Off Hand');
            data.push((sim.player.oh.totaldmg / sim.totalduration).toFixed(2));
            colors.push(view.colors[counter % view.colors.length]);
            counter++;
            if (sim.player.oh.totalprocdmg) {
                view.dmgdata.labels.push('Off Hand Proc');
                data.push((sim.player.oh.totalprocdmg / sim.totalduration).toFixed(2));
                colors.push(view.colors[counter % view.colors.length]);
                counter++;
            }
        }

        for (const key of ['sweepingstrikes', 'touchofthegrave']) {
            const aura = sim.player.auras[key];
            if (!aura?.totaldmg) continue;
            view.dmgdata.labels.push(aura.name);
            data.push((aura.totaldmg / sim.totalduration).toFixed(2));
            colors.push(view.colors[counter % view.colors.length]);
            counter++;
        }

        // DW
        if (sim.player.auras.deepwounds && sim.player.auras.deepwounds.totaldmg) {
            view.dmgdata.labels.push(sim.player.auras.deepwounds.name);
            data.push((sim.player.auras.deepwounds.totaldmg / sim.totalduration).toFixed(2));
            colors.push(view.colors[counter % view.colors.length]);
        }
        if (sim.player.auras.deepwounds2 && sim.player.auras.deepwounds2.totaldmg) {
            view.dmgdata.labels.push(sim.player.auras.deepwounds2.name);
            data.push((sim.player.auras.deepwounds2.totaldmg / sim.totalduration).toFixed(2));
            colors.push(view.colors[counter % view.colors.length]);
        }
        if (sim.player.auras.deepwounds3 && sim.player.auras.deepwounds3.totaldmg) {
            view.dmgdata.labels.push(sim.player.auras.deepwounds3.name);
            data.push((sim.player.auras.deepwounds3.totaldmg / sim.totalduration).toFixed(2));
            colors.push(view.colors[counter % view.colors.length]);
        }
        if (sim.player.auras.deepwounds4 && sim.player.auras.deepwounds4.totaldmg) {
            view.dmgdata.labels.push(sim.player.auras.deepwounds4.name);
            data.push((sim.player.auras.deepwounds4.totaldmg / sim.totalduration).toFixed(2));
            colors.push(view.colors[counter % view.colors.length]);
        }

        // Rend
        if (sim.player.auras.rend && sim.player.auras.rend.totaldmg) {
            view.dmgdata.labels.push(sim.player.auras.rend.name);
            data.push((sim.player.auras.rend.totaldmg / sim.totalduration).toFixed(2));
            colors.push(view.colors[counter % view.colors.length]);
        }

        view.dmgdata.datasets.push({
            data: data,
            fill: false,
            backgroundColor: colors,
        });

        view.buildSpreadData(sim);
    },

    // Fights per bin of DPS and of rage per second, as step areas over their own x-axes.
    // Each axis is scaled by its series' average, so a position on the chart is the same share
    // of average DPS and of average rage per second. Rage bins match the 1-DPS bins on that
    // shared scale, so both series' heights read off the one Fights axis.
    buildSpreadData: function (sim) {
        var view = this;
        // Engine keys: whole DPS, and thousandths of rage per second.
        const keyed = spread => Object.keys(spread || {}).filter(key => spread[key])
            .map(key => [Number(key), spread[key]]);
        const dpsKeys = keyed(sim.spread);
        const rageKeys = keyed(sim.ragespread);
        const fights = keys => keys.reduce((sum, [, count]) => sum + count, 0);
        const averageDps = sim.sumdps / sim.iterations;
        const averageRage = rageKeys.reduce((sum, [key, count]) => sum + key * count, 0) / fights(rageKeys) / 1000;
        const ratio = averageRage / averageDps;
        const showRage = rageKeys.length && ratio > 0 && Number.isFinite(ratio);
        const rageBin = showRage ? Math.max(1, Math.round(1000 * ratio)) : 1;

        // Zero-filled bins, with an empty bin at each end so the area closes on the baseline.
        const steps = (keys, width, toPoint) => {
            const bins = new Map();
            for (const [key, count] of keys) {
                const bin = Math.floor(key / width);
                bins.set(bin, (bins.get(bin) || 0) + count);
            }
            const first = keys.reduce((min, [key]) => Math.min(min, Math.floor(key / width)), Infinity);
            const last = keys.reduce((max, [key]) => Math.max(max, Math.floor(key / width)), -Infinity);
            const points = [];
            for (let bin = first - 1; bin <= last + 1; ++bin) points.push(toPoint(bin, bins.get(bin) || 0));
            return points;
        };
        const dpsPoints = steps(dpsKeys, 1, (bin, count) => ({x: bin, y: count, label: `${bin} DPS`}));
        const width = rageBin / 1000;
        const digits = width >= .1 ? 1 : width >= .01 ? 2 : 3;
        const ragePoints = showRage ? steps(rageKeys, rageBin, (bin, count) => ({
            x: (bin + .5) * width,
            y: count,
            label: rageBin === 1 ? `${(bin * width).toFixed(3)} rage/s` :
                `${(bin * width).toFixed(digits)}–${((bin + 1) * width).toFixed(digits)} rage/s`,
        })) : [];

        // Extents in DPS units; spreadRanges turns them into axis ranges.
        view.spreadRatio = ratio;
        view.spreadExtents = [[dpsPoints[0].x - .5, dpsPoints[dpsPoints.length - 1].x + .5]];
        const series = (label, xAxisID, points, color, fill) => ({
            label, xAxisID, data: points,
            borderColor: color, backgroundColor: fill, borderWidth: 2,
            fill: 'origin', steppedLine: 'middle', pointRadius: 0, pointHoverRadius: 3,
        });
        view.spreaddata = {datasets: [series(`DPS (average ${(sim.totaldmg / sim.totalduration).toFixed(2)})`,
            'dps', dpsPoints, '#e66767', 'rgba(230, 103, 103, 0.3)')]};
        if (showRage) {
            view.spreadExtents.push([(ragePoints[0].x - width / 2) / ratio,
                (ragePoints[ragePoints.length - 1].x + width / 2) / ratio]);
            view.spreaddata.datasets.push(series(
                `Rage per second (average ${(sim.ragegained / sim.totalduration).toFixed(2)})`,
                'rage', ragePoints, '#3987e5', 'rgba(57, 135, 229, 0.3)'));
        }
    },

    // DPS and rage axis ranges that cover the series where visible(index), on the shared scale.
    spreadRanges: function (visible) {
        var view = this;
        const extents = view.spreadExtents.filter((extent, i) => visible(i));
        if (!extents.length) return null;
        const min = Math.min(...extents.map(extent => extent[0]));
        const max = Math.max(...extents.map(extent => extent[1]));
        const rage = view.spreadExtents.length > 1 ? {min: min * view.spreadRatio, max: max * view.spreadRatio} : {};
        return [{min, max}, rage];
    },

    buildAuras: function () {
        var view = this;

        if (view.aurachart) view.aurachart.destroy();
        view.aurachart = new Chart(view.aura, {
            type: 'horizontalBar',
            data: view.auradata,
            showTooltips: false,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                legend: {
                    display: false,
                    align: 'center',
                    fullWidth: true
                },
                tooltips: {
                    enabled: false,
                },
                hover: {
                    mode: null
                },
                title: {
                    display: false,
                    text: 'Aura Uptime',
                    fontColor: '#ccc',
                    position: 'bottom'
                },
                scales: {
                    yAxes: [{
                        ticks: {
                            fontColor: '#ccc',
                        },
                        gridLines: {
                            display: false
                        }
                    }],
                    xAxes: [{
                        ticks: {
                            beginAtZero: true,
                            min: 0,
                            display: false,
                        },
                        gridLines: {
                            display: false
                        }
                    }]
                },
                animation: {
                    onComplete: function () {
                        var chartInstance = this.chart;
                        var ctx = this.chart.ctx;
                        this.data.datasets.forEach(function (dataset, i) {
                            var meta = chartInstance.controller.getDatasetMeta(i);
                            meta.data.forEach(function (bar, index) {
                                var data = dataset.data[index];
                                ctx.fillStyle = "#ddd";
                                ctx.shadowOffsetX = 2;
                                ctx.shadowOffsetY = 2;
                                ctx.shadowColor = "rgba(0,0,0,0.5)";
                                ctx.shadowBlur = 4;
                                ctx.fillText(data + '%', parseInt(data) < 11 ? bar._model.x + 10 : bar._model.x - 50, bar._model.y + 5);
                            });
                        });
                    }
                }
            },

        });
    },

    buildDamage: function () {
        var view = this;

        if (view.dmgchart) view.dmgchart.destroy();
        view.dmgchart = new Chart(view.dmg, {
            type: 'pie',
            data: view.dmgdata,
            options: {
                elements: {
                    arc: {
                        borderWidth: 1,
                    }
                },
                responsive: true,
                maintainAspectRatio: false,
                title: {
                    display: false,
                    text: 'DPS',
                    fontColor: '#ccc',
                    position: 'bottom'
                },
                animation: {
                    animateScale: true,
                    animateRotate: true
                },
                legend: {
                    display: false,
                    position: 'bottom',
                    labels: {
                        fontColor: '#ccc',
                    }
                },
                tooltips: {
                    callbacks: {
                        label: (item, obj) => ` ${obj.labels[item.index]}: ${obj.datasets[0].data[item.index]} DPS`,
                    }
                },
            }
        });

        view.dmglegend.html(view.dmgchart.generateLegend());
    },

    buildTable: function (sim) {
        var view = this;
        view.table.empty();
        let html = '<table><thead><tr><th>Action</th><th>Hit %</th><th>Crit %</th><th>Miss %</th><th>Dodge %</th><th>Glance %</th><th>Uses</th>' +
            '<th title="Times per fight this was the next ability to use, but there was not enough rage to pay for it">Rage Delays</th>' +
            '<th title="Seconds per fight spent waiting for that rage, until it could be used or something else came first">Rage Wait (s)</th>' +
            '<th title="Damage per rage. Rage is what was paid after refunds, plus rage lost to the stance swaps the ability needed (there and back), plus for Heroic Strike and Cleave the rage the white swing they replaced would have generated">DPR</th>' +
            '<th>DPS</th></tr></thead><tbody>';

        let i = sim.iterations;
        // Rage waits are counted for abilities that take a GCD; other rows leave these cells empty.
        const rage = action => action && action.ragedelays !== undefined ?
            `<td>${(action.ragedelays / i).toFixed(2)}</td><td>${(action.ragewait / 1000 / i).toFixed(2)}</td>` : '<td></td><td></td>';
        // Damage per rage, with the rage per use broken down in the cell's tooltip when uses are counted.
        const dpr = (action, uses) => {
            const cost = (action.ragespent || 0) + (action.stancerage || 0) + (action.whiterage || 0);
            if (!action.totaldmg || !(cost > 0)) return '<td></td>';
            const parts = [`${((action.ragespent || 0) / uses).toFixed(2)} paid after refunds`,
                `${((action.stancerage || 0) / uses).toFixed(2)} lost to stance swaps`];
            if (action.whiterage !== undefined) parts.push(`${(action.whiterage / uses).toFixed(2)} white swing rage given up`);
            const title = uses ? ` title="Rage per use: ${parts.join(', ')}"` : '';
            return `<td${title}>${(action.totaldmg / cost).toFixed(2)}</td>`;
        };
        let data = sim.player.mh.data;
        let total = data.reduce((a, b) => a + b, 0);
        let dps = (sim.player.mh.totaldmg / sim.totalduration).toFixed(2);
        html += `<tr><td>Main Hand</td><td>${(data[0] / total * 100).toFixed(2)}</td><td>${(data[3] / total * 100).toFixed(2)}</td><td>${(data[1] / total * 100).toFixed(2)}</td><td>${(data[2] / total * 100).toFixed(2)}</td><td>${(data[4] / total * 100).toFixed(2)}</td><td>${(total / i).toFixed(2)}</td>${rage()}<td></td><td>${dps}</td></tr>`;

        if (sim.player.oh) {
            data = sim.player.oh.data;
            total = data.reduce((a, b) => a + b, 0);
            dps = (sim.player.oh.totaldmg / sim.totalduration).toFixed(2);
            html += `<tr><td>Off Hand</td><td>${(data[0] / total * 100).toFixed(2)}</td><td>${(data[3] / total * 100).toFixed(2)}</td><td>${(data[1] / total * 100).toFixed(2)}</td><td>${(data[2] / total * 100).toFixed(2)}</td><td>${(data[4] / total * 100).toFixed(2)}</td><td>${(total / i).toFixed(2)}</td>${rage()}<td></td><td>${dps}</td></tr>`;
        }

        for (let name in sim.player.spells) {
            const spell = sim.player.spells[name];
            let n = spell.name;
            let data = spell.data;
            let total = data.reduce((a, b) => a + b, 0);
            // An ability that only ever waited for rage still gets a row.
            if (!total && !spell.ragedelays) continue;
            const percent = index => total ? (data[index] / total * 100).toFixed(2) : '';
            let dps = (spell.totaldmg / sim.totalduration).toFixed(2);
            // Heroic Strike and Cleave are queued on the next swing and never take a GCD.
            const queued = name == "heroicstrike" || name == "cleave";
            html += `<tr><td>${n}</td><td>${percent(0)}</td><td>${percent(3)}</td><td>${percent(1)}</td><td>${percent(2)}</td><td>${percent(4)}</td><td>${(total / i).toFixed(2)}</td>${rage(queued ? null : spell)}${dpr(spell, total)}<td>${dps}</td></tr>`;
        }

        const shown = new Set();
        if (sim.player.auras.rend) {
            shown.add('rend');
            let data = sim.player.auras.rend.data;
            let total = data.reduce((a, b) => a + b, 0);
            let totaldmg = sim.player.auras.rend.totaldmg;
            let dps = (totaldmg / sim.totalduration).toFixed(2);
            // Damage is every tick that landed; rage is what its applications paid.
            html += `<tr><td>${sim.player.auras.rend.name}</td><td></td><td></td><td>${(data[1] / total * 100).toFixed(2)}</td><td>${(data[2] / total * 100).toFixed(2)}</td><td></td><td>${(total / i).toFixed(2)}</td>${rage(sim.player.auras.rend)}${dpr(sim.player.auras.rend, total)}<td>${dps}</td></tr>`;
        }

        for (const key of ['sweepingstrikes', 'touchofthegrave', 'deepwounds', 'deepwounds2', 'deepwounds3', 'deepwounds4']) {
            const aura = sim.player.auras[key];
            if (!aura?.totaldmg) continue;
            shown.add(key);
            const dps = (aura.totaldmg / sim.totalduration).toFixed(2);
            // These effects have no separate recorded attack table. Only Sweeping Strikes costs rage.
            html += `<tr><td>${aura.name}</td><td></td><td></td><td></td><td></td><td></td><td></td>${rage(key == 'sweepingstrikes' ? aura : null)}${dpr(aura, 0)}<td>${dps}</td></tr>`;
        }

        // Rage waits only: Death Wish, and any other aura that waited for rage without a row above.
        for (const [key, aura] of Object.entries(sim.player.auras)) {
            if (shown.has(key) || (key != 'deathwish' && !aura.ragedelays)) continue;
            html += `<tr><td>${aura.name}</td><td></td><td></td><td></td><td></td><td></td><td></td>${rage(aura)}<td></td><td></td></tr>`;
        }

        html += '</tbody></table>';

        view.table.append(html);
        view.table.find('table').tablesorter({
            widthFixed: true,
        });
    },

    buildSpread: function () {
        var view = this;
        // The range ends are exact, not round, so they are left unlabeled.
        const innerTicks = (scale, ticks) => ticks.length > 2 ? ticks.slice(1, -1) : ticks;
        const ranges = view.spreadRanges(() => true);
        const xAxis = (id, position, label, range) => ({
            id, position, type: 'linear', display: 'auto', afterBuildTicks: innerTicks,
            ticks: {fontColor: '#aaa', maxRotation: 0, ...range},
            gridLines: {display: false},
            scaleLabel: {display: true, labelString: label, fontColor: '#ccc'},
        });

        if (view.spreadchart) view.spreadchart.destroy();
        view.spreadchart = new Chart(view.spread, {
            type: 'line',
            data: view.spreaddata,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                legend: {
                    display: true,
                    position: 'top',
                    labels: {fontColor: '#ccc', boxWidth: 12},
                    onClick: function (event, item) {
                        const chart = this.chart;
                        const meta = chart.getDatasetMeta(item.datasetIndex);
                        meta.hidden = meta.hidden === null ? !chart.data.datasets[item.datasetIndex].hidden : null;
                        const ranges = view.spreadRanges(i => chart.isDatasetVisible(i));
                        if (ranges) chart.options.scales.xAxes.forEach((axis, i) => Object.assign(axis.ticks, ranges[i]));
                        chart.update();
                    },
                },
                plugins: {
                    filler: {
                        propagate: false
                    }
                },
                scales: {
                    xAxes: [xAxis('dps', 'bottom', 'DPS', ranges[0]), xAxis('rage', 'top', 'Rage per second', ranges[1])],
                    yAxes: [{
                        ticks: {beginAtZero: true, precision: 0, fontColor: '#aaa'},
                        gridLines: {color: 'rgba(255, 255, 255, 0.08)', zeroLineColor: 'rgba(255, 255, 255, 0.2)'},
                        scaleLabel: {display: true, labelString: 'Fights', fontColor: '#ccc'},
                    }],
                },
                hover: {mode: 'nearest', intersect: false, axis: 'x'},
                tooltips: {
                    mode: 'nearest',
                    intersect: false,
                    axis: 'x',
                    callbacks: {
                        title: () => '',
                        label: (item, data) => {
                            const point = data.datasets[item.datasetIndex].data[item.index];
                            return ` ${point.label}: ${point.y} ${point.y === 1 ? 'fight' : 'fights'}`;
                        },
                    }
                },
            }
        });
    },
};
