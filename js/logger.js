class Logger {
    constructor() {
        this.logs = [];
        this.maxLogs = 1000; 
        this.unreadCount = 0;
        this.categories = {
            NETWORK: '🌐',
            PACKET: '📦',
            NODE: '🔵',
            EDGE: '↔️',
            ROUTING: '🛣️',
            SIMULATION: '⚙️',
            ERROR: '❌'
        };
        this.setupUI();
    }

    setupUI() {
        
        const logPanel = document.createElement('div');
        logPanel.id = 'logPanel';
        logPanel.className = 'log-panel';
        logPanel.innerHTML = `
            <div class="log-header">
                <h3><i class="fas fa-terminal"></i> Network Logs</h3>
                <div class="log-controls">
                    <button id="clearLogs" title="Clear Logs">
                        <i class="fas fa-trash"></i>
                        Clear
                    </button>
                    <button id="toggleAutoScroll" title="Toggle Auto-scroll" class="active">
                        <i class="fas fa-scroll"></i>
                        Auto-scroll
                    </button>
                    <button id="closeLogPanel" title="Close">
                        <i class="fas fa-times"></i>
                        Close
                    </button>
                </div>
            </div>
            <div class="log-filters">
                <label><input type="checkbox" data-category="NETWORK" checked> Network</label>
                <label><input type="checkbox" data-category="PACKET" checked> Packets</label>
                <label><input type="checkbox" data-category="NODE" checked> Nodes</label>
                <label><input type="checkbox" data-category="EDGE" checked> Edges</label>
                <label><input type="checkbox" data-category="ROUTING" checked> Routing</label>
                <label><input type="checkbox" data-category="SIMULATION" checked> Simulation</label>
                <label><input type="checkbox" data-category="ERROR" checked> Errors</label>
            </div>
            <div class="log-content"></div>
        `;
        document.body.appendChild(logPanel);

        
        document.getElementById('toggleLogs').addEventListener('click', () => {
            this.togglePanel();
            this.clearUnreadCount();
        });
        document.getElementById('closeLogPanel').addEventListener('click', () => {
            this.togglePanel();
        });
        document.getElementById('clearLogs').addEventListener('click', () => this.clearLogs());
        
        
        const filters = document.querySelectorAll('.log-filters input');
        filters.forEach(filter => {
            filter.addEventListener('change', () => this.applyFilters());
        });

        this.autoScroll = true;
        document.getElementById('toggleAutoScroll').addEventListener('click', (e) => {
            this.autoScroll = !this.autoScroll;
            e.currentTarget.classList.toggle('active', this.autoScroll);
        });

        
        this.updateBadge();
    }

    log(category, message, details = null) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = {
            timestamp,
            category,
            message,
            details,
            id: Date.now() + Math.random()
        };

        this.logs.unshift(logEntry); 
        if (this.logs.length > this.maxLogs) {
            this.logs.pop(); 
        }

        
        if (!document.getElementById('logPanel').classList.contains('visible')) {
            this.unreadCount++;
            this.updateBadge();
        }

        this.updateLogDisplay();
    }

    updateLogDisplay() {
        const logContent = document.querySelector('.log-content');
        const filters = Array.from(document.querySelectorAll('.log-filters input:checked'))
            .map(input => input.dataset.category);

        const logHTML = this.logs
            .filter(log => filters.includes(log.category))
            .map(log => {
                const details = log.details ? `<pre>${JSON.stringify(log.details, null, 2)}</pre>` : '';
                return `
                    <div class="log-entry" data-category="${log.category}">
                        <span class="log-timestamp">${log.timestamp}</span>
                        <span class="log-category">${this.categories[log.category]}</span>
                        <span class="log-message">${log.message}</span>
                        ${details}
                    </div>
                `;
            })
            .join('');

        logContent.innerHTML = logHTML;

        if (this.autoScroll) {
            logContent.scrollTop = 0;
        }
    }

    togglePanel() {
        const panel = document.getElementById('logPanel');
        panel.classList.toggle('visible');
    }

    clearLogs() {
        if (confirm('Are you sure you want to clear all logs?')) {
            this.logs = [];
            this.updateLogDisplay();
            this.clearUnreadCount();
        }
    }

    applyFilters() {
        this.updateLogDisplay();
    }

    updateBadge() {
        const badge = document.querySelector('.log-badge');
        if (this.unreadCount > 0) {
            badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
            badge.classList.add('visible');
        } else {
            badge.classList.remove('visible');
        }
    }

    clearUnreadCount() {
        this.unreadCount = 0;
        this.updateBadge();
    }
} 