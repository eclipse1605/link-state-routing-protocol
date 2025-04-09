 document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('networkCanvas');
    const network = new Network();
    const visualization = new Visualization(canvas, network);
    const logger = network.logger;
    
    visualization.resetView();

    const history = {
        past: [],
        future: [],
        current: null,
        maxSize: 20
    };

    function saveState(){
        const state = {
            nodes: Array.from(network.nodes.entries()).map(([id, node]) => ({
                id: node.id,
                x: node.x,
                y: node.y,
                neighbors: Array.from(node.neighbors.entries()).map(([neighborId, data]) => ({
                    id: neighborId,
                    weight: data.weight
                }))
            })),
            selectedNodeId: network.selectedNode ? network.selectedNode.id : null,
            nextNodeId: network.nextNodeId
        };

        if (history.current !== null){
            history.past.push(history.current);
            if (history.past.length > history.maxSize){
                history.past.shift();
            }
        }
        history.current = state;
        history.future = [];
        
        updateHistoryButtons();
    }

    function restoreState(state){
        if (!state) return;
        
        network.nodes.clear();
        network.selectedNode = null;
        network.helloPackets = [];
        network.lsaPackets = [];
        network.nextNodeId = state.nextNodeId;
        
        const nodeMap = new Map();
        for (const nodeData of state.nodes){
            const node = network.addNode(nodeData.x, nodeData.y, nodeData.id);
            nodeMap.set(nodeData.id, node);
        }
        
        for (const nodeData of state.nodes){
            const node = nodeMap.get(nodeData.id);
            if (node){
                node.neighbors.clear();
                node.lsa_db = {};
            }
        }
        
        for (const nodeData of state.nodes){
            const node = nodeMap.get(nodeData.id);
            if (node){
                for (const neighbor of nodeData.neighbors){
                    const neighborNode = nodeMap.get(neighbor.id);
                    if (neighborNode){
                        node.neighbors.set(neighbor.id, { 
                            weight: neighbor.weight,
                            lastUpdate: Date.now()
                        });
                        node.lsa_db[neighbor.id] = { 
                            weight: neighbor.weight, 
                            timestamp: Date.now() 
                        };
                    }
                }
            }
        }
        
        if (state.selectedNodeId !== null){
            network.selectedNode = nodeMap.get(state.selectedNodeId) || null;
            visualization.selectedNode = network.selectedNode;
            visualization.updateNodeDetails(network.selectedNode);
            removeNodeBtn.disabled = !network.selectedNode;
        } else {
            visualization.updateNodeDetails(null);
            removeNodeBtn.disabled = true;
        }
        
        visualization.render();
    }

    function updateHistoryButtons(){
        const undoButton = document.getElementById('undoButton');
        const redoButton = document.getElementById('redoButton');
        
        undoButton.disabled = history.past.length === 0 || network.isSimulationRunning;
        redoButton.disabled = history.future.length === 0 || network.isSimulationRunning;
        
        updateDisabledButtonTooltip(undoButton, 'No actions to undo');
        updateDisabledButtonTooltip(redoButton, 'No actions to redo');
    }

    function undo(){
        if (history.past.length === 0 || network.isSimulationRunning) return;
        
        history.future.unshift(history.current);
        
        const previousState = history.past.pop();
        history.current = previousState;
        
        
        restoreState(previousState);
        updateHistoryButtons();
        
        
        undoButton.classList.add('action-success');
        setTimeout(() => {
            undoButton.classList.remove('action-success');
        }, 300);
    }

    
    function redo(){
        if (history.future.length === 0 || network.isSimulationRunning) return;
        
        
        history.past.push(history.current);
        
        
        const nextState = history.future.shift();
        history.current = nextState;
        
        
        restoreState(nextState);
        updateHistoryButtons();
        
        
        redoButton.classList.add('action-success');
        setTimeout(() => {
            redoButton.classList.remove('action-success');
        }, 300);
    }

    
    saveState();

    
    function resizeCanvas(){
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        visualization.render();
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    
    let isAddingNode = false;

    
    const startHelloBtn = document.getElementById('startHello');
    const startLSABtn = document.getElementById('startLSA');
    const clearNetworkBtn = document.getElementById('clearNetwork');
    const resetViewBtn = document.getElementById('resetView');
    const resetSimulationBtn = document.getElementById('resetSimulation');
    const edgeTypeSelector = document.getElementById('edgeTypeSelector');
    const undoButton = document.getElementById('undoButton');
    const redoButton = document.getElementById('redoButton');
    
    
    const addNodeBtn = document.getElementById('addNode');
    const addEdgeBtn = document.getElementById('addEdge');
    const removeNodeBtn = document.getElementById('removeNode');
    const pauseSimulationBtn = document.getElementById('pauseSimulation');
    const viewAdjacencyListBtn = document.getElementById('viewAdjacencyList');

    
    function updateDisabledButtonTooltip(button, reason){
        if (button.disabled || button.classList.contains('disabled')){
            button.setAttribute('data-tooltip', reason);
        } else {
            button.removeAttribute('data-tooltip');
        }
    }

    
    function updateAllDisabledTooltips(){
        if (network.isSimulationRunning){
            updateDisabledButtonTooltip(addNodeBtn, 'Cannot add nodes during simulation');
            updateDisabledButtonTooltip(addEdgeBtn, 'Cannot add edges during simulation');
            updateDisabledButtonTooltip(clearNetworkBtn, 'Cannot clear during simulation');
            updateDisabledButtonTooltip(resetViewBtn, 'Cannot reset view during simulation');
            updateDisabledButtonTooltip(removeNodeBtn, 'Cannot remove nodes during simulation');
            updateDisabledButtonTooltip(undoButton, 'Cannot undo during simulation');
            updateDisabledButtonTooltip(redoButton, 'Cannot redo during simulation');
            updateDisabledButtonTooltip(pauseSimulationBtn, 'Cannot pause during simulation');
        } else {
            if (addNodeBtn.disabled && !isAddingNode){
                updateDisabledButtonTooltip(addNodeBtn, 'Currently adding edge');
            }
            
            if (addEdgeBtn.disabled && !visualization.edgeCreationState.isActive){
                updateDisabledButtonTooltip(addEdgeBtn, 'Currently adding node');
            }
            
            if (removeNodeBtn.disabled){
                updateDisabledButtonTooltip(removeNodeBtn, 'No node selected');
            }
            
            if (startLSABtn.disabled && !network.isSimulationRunning){
                updateDisabledButtonTooltip(startLSABtn, 'Complete Hello Phase first');
            }
            
            if (pauseSimulationBtn.disabled){
                updateDisabledButtonTooltip(pauseSimulationBtn, 'Simulation is paused');
            }
            
            updateDisabledButtonTooltip(undoButton, 'No actions to undo');
            updateDisabledButtonTooltip(redoButton, 'No actions to redo');
        }
    }

    
    function updateRoutingTableDisplay(node){
        const routingTableDiv = document.getElementById('routingTable');
        if (!node){
            routingTableDiv.innerHTML = 'No routing information available';
            return;
        }

        let html = '';
        if (node.routingTable.size === 0){
            html = '<div class="no-route">No routes available</div>';
        } else {
            if (network.isSimulationRunning && network.simulationPhase === 'hello') {
                html += '<div class="route-status">Live Routing Table (Hello Phase in Progress)</div>';
            }
            
            
            html += `
                <table class="routing-table">
                    <thead>
                        <tr>
                            <th>Network destination</th>
                            <th>Netmask</th>
                            <th>Gateway</th>
                            <th>Interface</th>
                            <th>Metric</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            
            html += `
                <tr>
                    <td>127.0.0.0</td>
                    <td>255.0.0.0</td>
                    <td>127.0.0.1</td>
                    <td>lo0</td>
                    <td>1</td>
                </tr>
                <tr>
                    <td>127.0.0.1</td>
                    <td>255.255.255.255</td>
                    <td>127.0.0.1</td>
                    <td>lo0</td>
                    <td>1</td>
                </tr>
                <tr>
                    <td>10.0.${node.id}.0</td>
                    <td>255.255.255.0</td>
                    <td>10.0.${node.id}.1</td>
                    <td>eth0</td>
                    <td>0</td>
                </tr>
                <tr>
                    <td>10.0.${node.id}.1</td>
                    <td>255.255.255.255</td>
                    <td>10.0.${node.id}.1</td>
                    <td>eth0</td>
                    <td>0</td>
                </tr>
            `;
            
            
            for (const [neighborId, neighborData] of node.neighbors) {
                html += `
                    <tr>
                        <td>10.0.${neighborId}.1</td>
                        <td>255.255.255.255</td>
                        <td>10.0.${node.id}.1</td>
                        <td>eth0</td>
                        <td>${neighborData.weight}</td>
                    </tr>
                `;
            }
            
            
            for (const [destId, route] of node.routingTable){
                const destNode = network.nodes.get(destId);
                if (!destNode) continue;
                
                const nextHopId = route.nextHop;
                const nextHopNode = nextHopId ? network.nodes.get(nextHopId) : null;
                const costDisplay = route.cost === Infinity ? '∞' : route.cost;
                
                
                
                const gatewayIP = nextHopId ? 
                    (node.neighbors.has(nextHopId) ? `10.0.${nextHopId}.1` : `10.0.${route.path[1]}.1`) : 
                    '-';
                
                html += `
                    <tr>
                        <td>10.0.${destId}.0</td>
                        <td>255.255.255.0</td>
                        <td>${gatewayIP}</td>
                        <td>${nextHopId ? 'eth0' : '-'}</td>
                        <td>${costDisplay}</td>
                    </tr>
                `;
            }
            
            
            html += `
                <tr>
                    <td>0.0.0.0</td>
                    <td>0.0.0.0</td>
                    <td>10.0.${node.id}.254</td>
                    <td>eth0</td>
                    <td>10</td>
                </tr>
            `;
            
            html += `
                    </tbody>
                </table>
            `;
            
            
            html += `<div class="path-info-header">Path Information</div>`;
            
            for (const [destId, route] of node.routingTable){
                const costDisplay = route.cost === Infinity ? 
                    '<span class="infinity-symbol">∞</span>' : route.cost;
                
                html += `
                    <div class="route-entry">
                        <div class="route-header">
                            <span class="route-destination">Router ${destId}</span>
                            <span class="route-cost">Cost: ${costDisplay}</span>
                        </div>
                        <div class="route-details">
                            <div class="route-path">
                                Path: ${route.path.map(id => `Router ${id}`).join(' <span class="path-arrow">→</span> ')}
                            </div>
                        </div>
                    </div>
                `;
            }
        }
        routingTableDiv.innerHTML = html;
    }

    
    visualization.updateNodeDetails = function(node){
        const nodeInfo = document.getElementById('nodeInfo');
        if (!node){
            nodeInfo.innerHTML = 'No node selected';
            document.getElementById('routingTable').innerHTML = 'No routing information available';
            return;
        }

        
        nodeInfo.innerHTML = `
            <div class="node-header">
                <div class="status-indicator ${node.isActive ? 'status-active' : ''}"></div>
                <h4>Router ${node.id}</h4>
            </div>
            <div class="info-row">
                <i class="fas fa-map-marker-alt"></i>
                Position: (${Math.round(node.x)}, ${Math.round(node.y)})
            </div>
            <div class="info-row">
                <i class="fas fa-network-wired"></i>
                Neighbors: ${node.neighbors.size}
            </div>
            <div class="info-row">
                <i class="fas fa-hashtag"></i>
                LSA Sequence: ${node.lsa_seq}
            </div>
            <div class="info-row">
                <i class="fas fa-database"></i>
                LSA Database Size: ${Object.keys(node.lsa_db).length}
            </div>
            <div class="neighbor-list">
                <h5>Neighbors</h5>
                ${Array.from(node.neighbors.entries()).map(([neighborId, data]) => `
                    <div class="neighbor-item">
                        <div class="neighbor-info">
                            <i class="fas fa-router"></i>
                            Router ${neighborId}
                            <span class="weight">Weight: ${data.weight}</span>
                        </div>
                        <div class="neighbor-actions">
                            <button onclick="updateEdgeWeight(${node.id}, ${neighborId})" title="Edit Weight">
                                <i class="fas fa-pencil-alt"></i>
                            </button>
                            <button onclick="removeEdge(${node.id}, ${neighborId})" title="Remove Edge">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        
        updateRoutingTableDisplay(node);
    };

    
    const weightDialog = document.createElement('div');
    weightDialog.className = 'weight-dialog';
    weightDialog.style.display = 'none';
    weightDialog.innerHTML = `
        <h3>Enter Edge Weight</h3>
        <input type="number" min="1" value="1" id="weightInput">
        <button id="confirmWeight">Confirm</button>
    `;
    document.body.appendChild(weightDialog);

    
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.style.display = 'none';
    document.body.appendChild(overlay);

    
    overlay.addEventListener('click', () => {
        weightDialog.style.display = 'none';
        overlay.style.display = 'none';
        
        visualization.edgeCreationState = {
            isActive: false,
            sourceNode: null,
            previewPos: null
        };
        
        addEdgeBtn.innerHTML = '<i class="fas fa-link"></i> Add Edge';
        addNodeBtn.disabled = false;
        canvas.style.cursor = 'grab'; 
        visualization.render();
    });

    
    const updateButtonStates = (isSimulationRunning) => {
        
        addNodeBtn.disabled = isSimulationRunning;
        addEdgeBtn.disabled = isSimulationRunning;
        clearNetworkBtn.disabled = isSimulationRunning;
        resetViewBtn.disabled = isSimulationRunning;
        removeNodeBtn.disabled = isSimulationRunning || !network.selectedNode;
        undoButton.disabled = isSimulationRunning || history.past.length === 0;
        redoButton.disabled = isSimulationRunning || history.future.length === 0;
        pauseSimulationBtn.disabled = !isSimulationRunning;
        
        
        [addNodeBtn, addEdgeBtn, clearNetworkBtn, resetViewBtn].forEach(btn => {
            if (isSimulationRunning){
                btn.classList.add('disabled');
            } else {
                btn.classList.remove('disabled');
            }
        });
        
        
        updateAllDisabledTooltips();
    };

    
    const resetButtonStates = () => {
        
        addNodeBtn.innerHTML = '<i class="fas fa-plus"></i> Add Node';
        addEdgeBtn.innerHTML = '<i class="fas fa-link"></i> Add Edge';
        
        
        addNodeBtn.classList.remove('active', 'disabled');
        addEdgeBtn.classList.remove('active', 'disabled');
        addNodeBtn.disabled = false;
        addEdgeBtn.disabled = false;
        
        
        canvas.style.cursor = 'grab'; 
    };

    
    const showWeightDialog = (callback, currentWeight = 1) => {
        weightDialog.style.display = 'block';
        overlay.style.display = 'block';
        const weightInput = document.getElementById('weightInput');
        weightInput.value = currentWeight;
        weightInput.focus();
        weightInput.select(); 
        
        
        const confirmWeight = () => {
            const weight = parseInt(weightInput.value);
            if (!isNaN(weight) && weight > 0){
                callback(weight);
                hideWeightDialog();
            } else {
                alert('Please enter a valid positive number for the weight.');
            }
        };
        
        
        const handleKeyPress = (e) => {
            if (e.key === 'Enter') {
                confirmWeight();
                e.preventDefault();
            }
        };
        
        
        weightInput.addEventListener('keypress', handleKeyPress);
        
        const confirmBtn = document.getElementById('confirmWeight');
        confirmBtn.onclick = confirmWeight;
        
        
        overlay.addEventListener('click', function onOverlayClick() {
            weightInput.removeEventListener('keypress', handleKeyPress);
            overlay.removeEventListener('click', onOverlayClick);
        }, { once: true });
    };

    
    const hideWeightDialog = () => {
        weightDialog.style.display = 'none';
        overlay.style.display = 'none';
    };

    
    addNodeBtn.addEventListener('click', () => {
        if (network.isSimulationRunning) return;
        
        isAddingNode = !isAddingNode;
        visualization.isAddingNode = isAddingNode;  
        
        if (isAddingNode){
            
            addNodeBtn.innerHTML = '<i class="fas fa-times"></i> Cancel Node';
            addNodeBtn.classList.add('active');
            canvas.classList.add('node-adding');
            canvas.style.cursor = 'crosshair'; 
            
            
            visualization.edgeCreationState.isActive = false;
            addEdgeBtn.innerHTML = '<i class="fas fa-link"></i> Add Edge';
            addEdgeBtn.classList.remove('active');
            addEdgeBtn.disabled = true;
            updateDisabledButtonTooltip(addEdgeBtn, 'Currently adding node');
            canvas.classList.remove('edge-adding');
        } else {
            
            addNodeBtn.innerHTML = '<i class="fas fa-plus"></i> Add Node';
            addNodeBtn.classList.remove('active');
            canvas.classList.remove('node-adding');
            canvas.style.cursor = 'grab'; 
            addEdgeBtn.disabled = false;
            addEdgeBtn.removeAttribute('data-tooltip');
        }
    });

    
    addEdgeBtn.addEventListener('click', () => {
        if (network.isSimulationRunning) return;
        
        visualization.edgeCreationState.isActive = !visualization.edgeCreationState.isActive;
        
        if (visualization.edgeCreationState.isActive){
            
            addEdgeBtn.innerHTML = '<i class="fas fa-times"></i> Cancel Edge';
            addEdgeBtn.classList.add('active');
            canvas.classList.add('edge-adding');
            canvas.style.cursor = 'default'; 
            
            
            isAddingNode = false;
            visualization.isAddingNode = false; 
            addNodeBtn.innerHTML = '<i class="fas fa-plus"></i> Add Node';
            addNodeBtn.classList.remove('active');
            addNodeBtn.disabled = true;
            updateDisabledButtonTooltip(addNodeBtn, 'Currently adding edge');
            canvas.classList.remove('node-adding');
            
            
            visualization.edgeCreationState = {
                isActive: true,
                sourceNode: null,
                previewPos: null
            };
        } else {
            
            addEdgeBtn.innerHTML = '<i class="fas fa-link"></i> Add Edge';
            addEdgeBtn.classList.remove('active');
            canvas.classList.remove('edge-adding');
            canvas.style.cursor = 'grab'; 
            addNodeBtn.disabled = false;
            addNodeBtn.removeAttribute('data-tooltip');
            
            
            visualization.edgeCreationState = {
                isActive: false,
                sourceNode: null,
                previewPos: null
            };
        }
        visualization.render();
    });

    
    function createEdgeWithWeight(sourceNode, targetNode){
        
        showWeightDialog((weight) => {
            const isBidirectional = edgeTypeSelector.value === 'double';
            if (network.connectNodes(sourceNode.id, targetNode.id, weight, isBidirectional)){
                visualization.updateNodeDetails(network.selectedNode);
                visualization.render();
            }
        });
    }

    
    startHelloBtn.addEventListener('click', () => {
        if (network.isSimulationRunning && network.simulationPhase === 'hello') {
            
            return;
        }
        
        if (network.isSimulationRunning) {
            
            network.stopSimulation();
            startHelloBtn.innerHTML = '<i class="fas fa-play"></i> Start Hello Phase';
            startHelloBtn.classList.remove('active');
            startLSABtn.disabled = true;
            updateDisabledButtonTooltip(startLSABtn, 'Complete Hello Phase first');
            
            
            updateButtonStates(false);
            
            
            isAddingNode = false;
            visualization.isAddingNode = false;  
            visualization.edgeCreationState.isActive = false;
            addNodeBtn.innerHTML = '<i class="fas fa-plus"></i> Add Node';
            addEdgeBtn.innerHTML = '<i class="fas fa-link"></i> Add Edge';
            addNodeBtn.classList.remove('active');
            addEdgeBtn.classList.remove('active');
            canvas.classList.remove('node-adding', 'edge-adding');
            canvas.style.cursor = 'grab';  
            
            startHelloBtn.setAttribute('data-tooltip', 'Start Hello Phase (Space)');
        } else {
            
            network.startHelloPhase();
            startHelloBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Hello Phase';
            startHelloBtn.classList.add('active');
            startHelloBtn.disabled = true; 
            startLSABtn.disabled = true;
            updateDisabledButtonTooltip(startLSABtn, 'Hello Phase is running');
            updateDisabledButtonTooltip(startHelloBtn, 'Hello Phase is running');
            
            
            updateButtonStates(true);
            
            
            isAddingNode = false;
            visualization.isAddingNode = false;  
            visualization.edgeCreationState.isActive = false;
            addNodeBtn.innerHTML = '<i class="fas fa-plus"></i> Add Node';
            addEdgeBtn.innerHTML = '<i class="fas fa-link"></i> Add Edge';
            addNodeBtn.classList.remove('active');
            addEdgeBtn.classList.remove('active');
            canvas.classList.remove('node-adding', 'edge-adding');
            canvas.style.cursor = 'default';
        }
    });

    
    startLSABtn.addEventListener('click', () => {
        if (network.isSimulationRunning && network.simulationPhase === 'lsa') {
            
            return;
        }
        
        if (network.isSimulationRunning){
            
            network.stopSimulation();
            startLSABtn.innerHTML = '<i class="fas fa-play"></i> Start Flooding';
            startLSABtn.classList.remove('active');
            
            
            addNodeBtn.disabled = false;
            addEdgeBtn.disabled = false;
            clearNetworkBtn.disabled = false;
            resetViewBtn.disabled = false;
            removeNodeBtn.disabled = !network.selectedNode;
            startHelloBtn.disabled = false;
            
            
            isAddingNode = false;
            visualization.isAddingNode = false;  
            visualization.edgeCreationState.isActive = false;
            addNodeBtn.innerHTML = '<i class="fas fa-plus"></i> Add Node';
            addEdgeBtn.innerHTML = '<i class="fas fa-link"></i> Add Edge';
            addNodeBtn.classList.remove('active');
            addEdgeBtn.classList.remove('active');
            canvas.classList.remove('node-adding', 'edge-adding');
            canvas.style.cursor = 'grab';  
            
            
            updateAllDisabledTooltips();
        } else {
            
            network.startLSAPhase();
            startLSABtn.innerHTML = '<i class="fas fa-stop"></i> Stop Flooding';
            startLSABtn.classList.add('active');
            startLSABtn.disabled = true; 
            startHelloBtn.disabled = true;
            updateDisabledButtonTooltip(startHelloBtn, 'LSA Flooding is running');
            updateDisabledButtonTooltip(startLSABtn, 'LSA Flooding is running');
            
            
            addNodeBtn.disabled = true;
            addEdgeBtn.disabled = true;
            clearNetworkBtn.disabled = true;
            resetViewBtn.disabled = true;
            removeNodeBtn.disabled = true;
            
            
            isAddingNode = false;
            visualization.isAddingNode = false;  
            visualization.edgeCreationState.isActive = false;
            addNodeBtn.innerHTML = '<i class="fas fa-plus"></i> Add Node';
            addEdgeBtn.innerHTML = '<i class="fas fa-link"></i> Add Edge';
            addNodeBtn.classList.remove('active');
            addEdgeBtn.classList.remove('active');
            canvas.classList.remove('node-adding', 'edge-adding');
            canvas.style.cursor = 'default'; 
            
            
            updateAllDisabledTooltips();
        }
    });

    
    clearNetworkBtn.addEventListener('click', () => {
        if (!network.isSimulationRunning && confirm('Are you sure you want to clear the network?')){
            
            network.nodes.clear();
            network.selectedNode = null;
            network.helloPackets = [];
            network.lsaPackets = [];
            network.isSimulationRunning = false;
            network.isSimulationComplete = false;
            network.nextNodeId = 1;
            network.simulationPhase = null;
            network.helloPhaseComplete = false;
            network.lsaPhaseComplete = false;
            
            
            startHelloBtn.innerHTML = '<i class="fas fa-play"></i> Start Hello Phase';
            startHelloBtn.classList.remove('active');
            startHelloBtn.disabled = false;
            startHelloBtn.removeAttribute('data-tooltip');
            
            startLSABtn.innerHTML = '<i class="fas fa-play"></i> Start Flooding';
            startLSABtn.classList.remove('active');
            startLSABtn.disabled = true;
            updateDisabledButtonTooltip(startLSABtn, 'Complete Hello Phase first');
            
            pauseSimulationBtn.innerHTML = '<i class="fas fa-pause"></i> Pause';
            pauseSimulationBtn.classList.remove('active');
            pauseSimulationBtn.disabled = true;
            updateDisabledButtonTooltip(pauseSimulationBtn, 'Simulation is paused');
            
            
            isAddingNode = false;
            visualization.isAddingNode = false;  
            visualization.edgeCreationState.isActive = false;
            addNodeBtn.innerHTML = '<i class="fas fa-plus"></i> Add Node';
            addEdgeBtn.innerHTML = '<i class="fas fa-link"></i> Add Edge';
            addNodeBtn.classList.remove('active');
            addEdgeBtn.classList.remove('active');
            canvas.classList.remove('node-adding', 'edge-adding');
            canvas.style.cursor = 'grab';  
            
            
            addNodeBtn.disabled = false;
            addEdgeBtn.disabled = false;
            removeNodeBtn.disabled = true;
            updateDisabledButtonTooltip(removeNodeBtn, 'No node selected');
            
            
            const pathFinderInfo = document.querySelector('.path-finder-info');
            if (pathFinderInfo) {
                pathFinderInfo.textContent = 'Complete LSA flooding to enable path finding';
                pathFinderInfo.style.color = '#ff9800';
            }
            document.getElementById('sourceNodeSelect').disabled = true;
            document.getElementById('destNodeSelect').disabled = true;
            document.getElementById('findPathBtn').disabled = true;
            document.getElementById('clearPathBtn').disabled = true;
            
            
            visualization.clearPath();
            
            
            document.getElementById('nodeInfo').innerHTML = 'No node selected';
            document.getElementById('routingTable').innerHTML = 'No routing information available';
            
            
            visualization.updateNodeDetails(null);
            visualization.render();
            
            
            visualization.resetView();
            
            
            updateHistoryButtons();
            
            
            saveState();
            
            network.logger.log('NETWORK', 'Network cleared and all simulation states reset');
        }
    });

    
    resetViewBtn.addEventListener('click', () => {
            visualization.resetView();
    });

    
    removeNodeBtn.addEventListener('click', () => {
        if (network.isSimulationRunning || !network.selectedNode) return;
        
        if (confirm(`Are you sure you want to remove Router ${network.selectedNode.id} and all its connections?`)){
            network.removeNode(network.selectedNode.id);
            network.selectedNode = null;
            visualization.updateNodeDetails(null);
            removeNodeBtn.disabled = true;
            removeNodeBtn.removeAttribute('data-tooltip');
            visualization.render();
        }
    });

    
    canvas.addEventListener('click', (event) => {
        if (!isAddingNode) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left - visualization.offset.x) / visualization.scale;
        const y = (event.clientY - rect.top - visualization.offset.y) / visualization.scale;
        
        
        const minDistance = 50; 
        let tooClose = false;
        
        for (const node of network.nodes.values()){
            const dx = x - node.x;
            const dy = y - node.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < minDistance){
                tooClose = true;
                break;
            }
        }
        
        if (!tooClose){
            const node = network.addNode(x, y);
            network.selectedNode = node;
            visualization.selectedNode = node;
            visualization.updateNodeDetails(node);
            removeNodeBtn.disabled = false;
            removeNodeBtn.removeAttribute('data-tooltip');
            
            
            isAddingNode = false;
            visualization.isAddingNode = false;  
            addNodeBtn.innerHTML = '<i class="fas fa-plus"></i> Add Node';
            addNodeBtn.classList.remove('active');
            canvas.classList.remove('node-adding');
            canvas.style.cursor = 'grab';  
            addEdgeBtn.disabled = false;
            
            visualization.render();
            
            
            saveState();
        }
    });

    
    const originalConnectNodes = network.connectNodes;
    network.connectNodes = function(sourceId, targetId, weight, isBidirectional){
        const result = originalConnectNodes.call(this, sourceId, targetId, weight, isBidirectional);
        if (result){
            saveState();
        }
        return result;
    };

    
    window.removeEdge = function(sourceId, targetId){
        if (network.isSimulationRunning) return;
        
        if (confirm(`Are you sure you want to remove the connection between Router ${sourceId} and Router ${targetId}?`)){
            const sourceNode = network.nodes.get(sourceId);
            if (sourceNode && sourceNode.neighbors.has(targetId)){
                
                const targetNode = network.nodes.get(targetId);
                const isBidirectional = targetNode && targetNode.neighbors.has(sourceId);
                
                
                network.disconnectNodes(sourceId, targetId);
                
                
                visualization.updateNodeDetails(network.selectedNode);
                visualization.render();
                
                
                saveState();
            }
        }
    };

    
    window.updateEdgeWeight = function(sourceId, targetId){
        if (network.isSimulationRunning) return;
        
        const sourceNode = network.nodes.get(sourceId);
        const targetNode = network.nodes.get(targetId);
        
        if (sourceNode && targetNode){
            const neighborData = sourceNode.neighbors.get(targetId);
            if (neighborData){
                
                const isBidirectional = targetNode.neighbors.has(sourceId);
                
                showWeightDialog((weight) => {
                    
                    network.updateEdgeWeight(sourceId, targetId, weight);
                    
                    
                    visualization.updateNodeDetails(network.selectedNode);
                    visualization.render();
                    
                    
                    saveState();
                }, neighborData.weight);
            }
        }
    };

    
    const originalRemoveNode = network.removeNode;
    network.removeNode = function(nodeId){
        originalRemoveNode.call(this, nodeId);
        saveState();
    };

    
    function setupDemoNetwork(){
        const node1 = network.addNode(100, 100);
        const node2 = network.addNode(300, 100);
        const node3 = network.addNode(100, 300);
        const node4 = network.addNode(300, 300);
        
        
        network.connectNodes(node1.id, node2.id, 5);
        network.connectNodes(node2.id, node4.id, 3);
        network.connectNodes(node1.id, node3.id, 7);
        network.connectNodes(node3.id, node4.id, 4);
        
        visualization.render();
    }

    
    document.addEventListener('keydown', (event) => {
        
        if (event.target.tagName === 'INPUT') return;
        
        
        if (network.isSimulationRunning) return;

        
        if (event.ctrlKey && event.key.toLowerCase() === 'z'){
            event.preventDefault();
            if (!undoButton.disabled){
                undo();
                network.logger.log('NETWORK', 'Undo action performed');
            }
            return;
        }
        
        
        if (event.ctrlKey && event.key.toLowerCase() === 'y'){
            event.preventDefault();
            if (!redoButton.disabled){
                redo();
                network.logger.log('NETWORK', 'Redo action performed');
            }
            return;
        }

        
        if (event.ctrlKey) return;

        switch (event.key.toLowerCase()){
            case 'n':
                if (!network.isSimulationRunning){
                    addNodeBtn.click();
                }
                break;
            case 'e':
                if (!network.isSimulationRunning){
                    addEdgeBtn.click();
                }
                break;
    case ' ': 
        if (network.isSimulationRunning) {
            pauseSimulationBtn.click();
        } else {
            
            resetSimulationState();
        }
        if (network.isSimulationRunning) {
            pauseSimulationBtn.click();
        }
        break;
    case 'c':
        if (!network.isSimulationRunning){
            clearNetworkBtn.click();
        }
        break;
    case 'v':
        resetViewBtn.click();
        break;
    case 'delete':
        if (!network.isSimulationRunning && network.selectedNode){
            removeNodeBtn.click();
        }
    case 'escape':
        if (isAddingNode){
            addNodeBtn.click();
        }
        if (visualization.edgeCreationState.isActive){
            addEdgeBtn.click();
        }
        break;
    }
});

    
    undoButton.addEventListener('click', () => {
        if (!undoButton.disabled){
            undo();
            network.logger.log('NETWORK', 'Undo action performed');
        }
    });
    
    
    redoButton.addEventListener('click', () => {
        if (!redoButton.disabled){
            redo();
            network.logger.log('NETWORK', 'Redo action performed');
        }
    });

    
    setupDemoNetwork();
    
    
    
    history.current = {
        nodes: Array.from(network.nodes.entries()).map(([id, node]) => ({
            id: node.id,
            x: node.x,
            y: node.y,
            neighbors: Array.from(node.neighbors.entries()).map(([neighborId, data]) => ({
                id: neighborId,
                weight: data.weight
            }))
        })),
        selectedNodeId: network.selectedNode ? network.selectedNode.id : null,
        nextNodeId: network.nextNodeId
    };
    history.past = []; 
    history.future = []; 
    updateHistoryButtons();

    
    function animate() {
        if (network.isSimulationRunning) {
            network.simulationStep();
            
            
            if (network.selectedNode) {
                visualization.updateNodeDetails(network.selectedNode);
            }
            
            
            if (network.selectedNodeNeedsUpdate) {
                visualization.updateNodeDetails(network.selectedNode);
                network.selectedNodeNeedsUpdate = false;
            }
            
            
            if (network.simulationPhase === 'hello' && network.helloPhaseComplete) {
                startHelloBtn.innerHTML = '<i class="fas fa-play"></i> Start Hello Phase';
                startHelloBtn.classList.remove('active');
                startHelloBtn.disabled = false;
                startHelloBtn.removeAttribute('data-tooltip');
                startLSABtn.disabled = false;
                startLSABtn.removeAttribute('data-tooltip');
                network.isSimulationRunning = false;
                
                
                network.updateRoutingTables();
                
                
                if (network.selectedNode) {
                    visualization.updateNodeDetails(network.selectedNode);
                }
                
                canvas.style.cursor = 'grab'; 
                network.logger.log('NETWORK', 'Hello phase complete, routing tables generated');
                
                updateButtonStates(false);
            }
            
            
            if (network.simulationPhase === 'lsa' && network.lsaPhaseComplete) {
                startLSABtn.innerHTML = '<i class="fas fa-play"></i> Start Flooding';
                startLSABtn.classList.remove('active');
                startLSABtn.disabled = false;
                startLSABtn.removeAttribute('data-tooltip');
                startHelloBtn.disabled = false;
                startHelloBtn.removeAttribute('data-tooltip');
                network.isSimulationRunning = false;
                canvas.style.cursor = 'grab';
                
                
                const pathFinderInfo = document.querySelector('.path-finder-info');
                if (pathFinderInfo) {
                    pathFinderInfo.textContent = 'Find shortest path between routers';
                    pathFinderInfo.style.color = '#4CAF50';
                }
                
                document.getElementById('sourceNodeSelect').disabled = false;
                document.getElementById('destNodeSelect').disabled = false;
                document.getElementById('findPathBtn').disabled = false;
                document.getElementById('clearPathBtn').disabled = false;
                
                network.isSimulationComplete = true;
                network.logger.log('NETWORK', 'LSA flooding complete, path finding now available');
                
                updateButtonStates(false);
            }
        }
        visualization.render();
        requestAnimationFrame(animate);
    }
    animate();

    
    pauseSimulationBtn.addEventListener('click', () => {
        if (network.isSimulationRunning) {
            const isPaused = network.pauseSimulation();
            if (isPaused) {
                pauseSimulationBtn.innerHTML = '<i class="fas fa-play"></i> Resume';
                pauseSimulationBtn.classList.add('active');
            } else {
                pauseSimulationBtn.innerHTML = '<i class="fas fa-pause"></i> Pause';
                pauseSimulationBtn.classList.remove('active');
            }
        }
    });

    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'p' || e.key === 'P') {
            if (!pauseSimulationBtn.disabled) {
                pauseSimulationBtn.click();
            }
        }
    });

    
    const adjacencyListModal = document.getElementById('adjacencyListModal');
    const adjacencyListContent = document.getElementById('adjacencyListContent');
    const closeModalBtn = document.querySelector('.close-modal');
    
    if (viewAdjacencyListBtn && adjacencyListModal && adjacencyListContent && closeModalBtn) {
        viewAdjacencyListBtn.addEventListener('click', () => {
            displayAdjacencyList();
            adjacencyListModal.style.display = 'block';
        });

        closeModalBtn.addEventListener('click', () => {
            adjacencyListModal.style.display = 'none';
        });

        window.addEventListener('click', (event) => {
            if (event.target === adjacencyListModal) {
                adjacencyListModal.style.display = 'none';
            }
        });
    }

    
    function displayAdjacencyList() {
        if (network.nodes.size === 0) {
            adjacencyListContent.innerHTML = '<div class="adjacency-list-empty">No nodes in the network</div>';
            return;
        }

        
        let html = `
            <table class="adjacency-list-table">
                <thead>
                    <tr>
                        <th>Source Router</th>
                        <th>Target Router</th>
                        <th>Weight</th>
                        <th>Direction</th>
                    </tr>
                </thead>
                <tbody>
        `;

        
        const displayedEdges = new Set();

        
        for (const [sourceId, sourceNode] of network.nodes) {
            for (const [targetId, data] of sourceNode.neighbors) {
                const targetNode = network.nodes.get(targetId);
                if (!targetNode) continue;

                
                const isBidirectional = targetNode.neighbors.has(sourceId);
                
                
                if (isBidirectional) {
                    
                    const edgeKey = sourceId < targetId 
                        ? `${sourceId}-${targetId}` 
                        : `${targetId}-${sourceId}`;
                    
                    
                    if (displayedEdges.has(edgeKey)) continue;
                    displayedEdges.add(edgeKey);
                }

                html += `
                    <tr>
                        <td>Router ${sourceId}</td>
                        <td>Router ${targetId}</td>
                        <td>${data.weight}</td>
                        <td>
                            ${isBidirectional 
                                ? '<span class="direction-indicator bidirectional">Bidirectional</span>' 
                                : '<span class="direction-indicator unidirectional">Unidirectional</span>'}
                        </td>
                    </tr>
                `;
            }
        }

        html += `
                </tbody>
            </table>
        `;

        adjacencyListContent.innerHTML = html;
    }

    function updateNetworkStatus() {
        document.getElementById('nodeCount').textContent = network.nodes.size;
        document.getElementById('edgeCount').textContent = network.edges.size;
        
        
        checkNetworkConnectivity();
    }

    
    function checkNetworkConnectivity() {
        if (network.nodes.size === 0) return;
        
        
        const visited = new Map();
        for (const nodeId of network.nodes.keys()) {
            visited.set(nodeId, false);
        }
        
        
        const startNodeId = network.nodes.keys().next().value;
        dfs(startNodeId, visited);
        
        
        for (const [nodeId, isVisited] of visited) {
            const node = network.nodes.get(nodeId);
            const wasIsolated = node.isIsolated;
            node.isIsolated = !isVisited;
            
            
            if (!wasIsolated && node.isIsolated) {
                console.log(`Node ${nodeId} is now isolated, clearing routing table`);
                node.routingTable.clear();
                updateRoutingTableDisplay(node);
            }
            
            
            visualization.updateNodeStyle(nodeId);
        }
    }

    
    function dfs(nodeId, visited) {
        visited.set(nodeId, true);
        const node = network.nodes.get(nodeId);
        
        for (const neighborId of node.neighbors.keys()) {
            if (!visited.get(neighborId)) {
                dfs(neighborId, visited);
            }
        }
    }

    function exportNetwork() {
        const networkState = {
            nodes: Array.from(network.nodes.entries()).map(([id, node]) => ({
                id: node.id,
                x: node.x,
                y: node.y,
                neighbors: Array.from(node.neighbors.entries()).map(([neighborId, data]) => ({
                    id: neighborId,
                    weight: data.weight,
                    isBidirectional: network.nodes.get(neighborId)?.neighbors.has(node.id) || false
                }))
            })),
            nextNodeId: network.nextNodeId,
            version: "1.0"
        };

        const jsonString = JSON.stringify(networkState, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const a = document.createElement('a');
        a.href = url;
        a.download = `network_state_${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        network.logger.log('NETWORK', 'Network exported successfully');
    }

    function importNetwork(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const networkState = JSON.parse(e.target.result);
                
                
                if (!networkState.nodes || !Array.isArray(networkState.nodes)) {
                    throw new Error('Invalid network state format');
                }
                
                
                network.nodes.clear();
                network.selectedNode = null;
                network.helloPackets = [];
                network.lsaPackets = [];
                network.nextNodeId = networkState.nextNodeId || 1;
                network.resetSimulationState(true);
                
                
                const nodeMap = new Map();
                for (const nodeData of networkState.nodes) {
                    if (!nodeData.id || typeof nodeData.x !== 'number' || typeof nodeData.y !== 'number') {
                        throw new Error('Invalid node data format');
                    }
                    const node = network.addNode(nodeData.x, nodeData.y, nodeData.id);
                    nodeMap.set(nodeData.id, node);
                }
                
                
                const processedEdges = new Set(); 
                for (const nodeData of networkState.nodes) {
                    const sourceNode = nodeMap.get(nodeData.id);
                    if (!sourceNode) continue;
                    
                    
                    sourceNode.neighbors.clear();
                    sourceNode.lsa_db = {};
                    
                    if (!nodeData.neighbors || !Array.isArray(nodeData.neighbors)) continue;
                    
                    for (const neighbor of nodeData.neighbors) {
                        if (!neighbor.id || typeof neighbor.weight !== 'number') continue;
                        
                        const targetNode = nodeMap.get(neighbor.id);
                        if (!targetNode) continue;
                        
                        
                        const edgeId = [Math.min(nodeData.id, neighbor.id), Math.max(nodeData.id, neighbor.id)].join('-');
                        
                        
                        if (processedEdges.has(edgeId)) continue;
                        
                        
                        network.connectNodes(
                            nodeData.id,
                            neighbor.id,
                            neighbor.weight,
                            neighbor.isBidirectional
                        );
                        
                        processedEdges.add(edgeId);
                    }
                }
                
                
                visualization.resetView();
                visualization.render();
                saveState();
                
                network.logger.log('NETWORK', 'Network imported successfully');
            } catch (error) {
                network.logger.log('ERROR', 'Failed to import network: ' + error.message);
                alert('Failed to import network: ' + error.message);
            }
        };
        reader.readAsText(file);
    }

    document.getElementById('exportNetwork').addEventListener('click', exportNetwork);
    
    const importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.accept = '.json';
    importInput.style.display = 'none';
    document.body.appendChild(importInput);
    
    document.getElementById('importNetwork').addEventListener('click', () => {
        importInput.click();
    });
    
    importInput.addEventListener('change', importNetwork);

    
    const helpBtn = document.createElement('button');
    helpBtn.innerHTML = '<i class="fas fa-question-circle"></i> Help';
    helpBtn.id = 'helpButton';
    helpBtn.className = 'help-button';
    document.body.appendChild(helpBtn);

    
    const helpModal = document.createElement('div');
    helpModal.className = 'help-modal';
    helpModal.innerHTML = `
        <div class="help-content">
            <h2>Link-State Routing Simulator Guide</h2>
            
            <h3>Network Creation</h3>
            <ul>
                <li><strong>Add Node:</strong> Click "Add Node" button, then click anywhere on canvas</li>
                <li><strong>Move Node:</strong> Click and drag any router</li>
                <li><strong>Add Edge:</strong> Click "Add Edge" button, click source router, then destination router</li>
                <li><strong>Delete Node:</strong> Select a router, then click "Remove Node"</li>
                <li><strong>Edit Edge:</strong> Click router to view neighbors, use Edit/Delete buttons next to each neighbor</li>
            </ul>

            <h3>Simulation Controls</h3>
            <ul>
                <li><strong>Start Hello Phase:</strong> Initiates neighbor discovery process</li>
                <li><strong>Start Flooding:</strong> Begins LSA flooding (available after Hello phase)</li>
                <li><strong>Stop Simulation:</strong> Click the active phase button again</li>
            </ul>

            <h3>Navigation</h3>
            <ul>
                <li><strong>Pan:</strong> Click and drag empty space</li>
                <li><strong>Zoom:</strong> Mouse wheel up/down</li>
                <li><strong>Reset View:</strong> Click "Reset View" button</li>
                <li><strong>Select Router:</strong> Click on any router to view details</li>
            </ul>

            <h3>Link-State Protocol Steps</h3>
            <ol>
                <li>Each router discovers neighbors using Hello packets</li>
                <li>Routers create Link-State Advertisements (LSAs) containing:
                    <ul>
                        <li>Router ID</li>
                        <li>List of neighbors and costs</li>
                    </ul>
                </li>
                <li>LSAs are flooded through the network</li>
                <li>Each router builds complete network map</li>
                <li>Dijkstra's algorithm calculates shortest paths</li>
            </ol>

            <button id="closeHelp" class="close-button">Close</button>
        </div>
    `;
    document.body.appendChild(helpModal);

    
    const style = document.createElement('style');
    style.textContent = `
        .help-modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.7);
            z-index: 1000;
            overflow-y: auto;
        }

        .help-content {
            position: relative;
            background-color: #2d2d2d;
            color: #fff;
            margin: 50px auto;
            padding: 20px;
            width: 80%;
            max-width: 800px;
            border-radius: 8px;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
        }

        .help-content h2 {
            color: #4CAF50;
            margin-bottom: 20px;
            border-bottom: 2px solid #4CAF50;
            padding-bottom: 10px;
        }

        .help-content h3 {
            color: #2196F3;
            margin: 20px 0 10px 0;
        }

        .help-content ul, .help-content ol {
            margin-left: 20px;
            margin-bottom: 15px;
        }

        .help-content li {
            margin: 8px 0;
            line-height: 1.4;
        }

        .help-content strong {
            color: #4CAF50;
        }

        .close-button {
            position: absolute;
            top: 10px;
            right: 10px;
            padding: 8px 15px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }

        .close-button:hover {
            background-color: #45a049;
        }

        #helpButton {
            background-color: #2196F3;
        }

        #helpButton:hover {
            background-color: #1976D2;
        }

        .help-button {
            position: fixed;
            bottom: 20px;
            left: 20px;
            z-index: 1000;
            padding: 10px 20px;
            background-color: #2196F3;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            transition: background-color 0.2s;
        }

        .help-button:hover {
            background-color: #1976D2;
        }

        .help-button i {
            font-size: 16px;
        }
    `;
    document.head.appendChild(style);

    
    helpBtn.addEventListener('click', () => {
        helpModal.style.display = 'block';
    });

    document.getElementById('closeHelp').addEventListener('click', () => {
        helpModal.style.display = 'none';
    });

    
    helpModal.addEventListener('click', (e) => {
        if (e.target === helpModal) {
            helpModal.style.display = 'none';
        }
    });

    
    document.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'h') {
            helpModal.style.display = helpModal.style.display === 'none' ? 'block' : 'none';
        }
    });

    
    const contextMenu = document.createElement('div');
    contextMenu.className = 'context-menu';
    contextMenu.innerHTML = `
        <div class="context-menu-item" id="addNodeContext">Add Node Here</div>
    `;
    contextMenu.style.display = 'none';
    document.body.appendChild(contextMenu);

    
    const contextMenuStyle = document.createElement('style');
    contextMenuStyle.textContent = `
        .context-menu {
            position: fixed;
            background-color: #2d2d2d;
            border: 1px solid #4CAF50;
            border-radius: 4px;
            padding: 5px 0;
            min-width: 150px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            z-index: 1000;
        }

        .context-menu-item {
            padding: 8px 15px;
            color: #fff;
            cursor: pointer;
            transition: background-color 0.2s;
        }

        .context-menu-item:hover {
            background-color: #4CAF50;
        }
    `;
    document.head.appendChild(contextMenuStyle);

    
    canvas.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        
        if (network.isSimulationRunning) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left - visualization.offset.x) / visualization.scale;
        const y = (event.clientY - rect.top - visualization.offset.y) / visualization.scale;
        
        
        let clickedOnNode = false;
        for (const node of network.nodes.values()) {
            const dx = x - node.x;
            const dy = y - node.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < 20) { 
                clickedOnNode = true;
                break;
            }
        }
        
        if (!clickedOnNode) {
            contextMenu.style.display = 'block';
            contextMenu.style.left = `${event.clientX}px`;
            contextMenu.style.top = `${event.clientY}px`;
            
            
            contextMenu.dataset.x = x;
            contextMenu.dataset.y = y;
        }
    });

    
    document.addEventListener('click', (event) => {
        if (!contextMenu.contains(event.target)) {
            contextMenu.style.display = 'none';
        }
    });

    
    document.getElementById('addNodeContext').addEventListener('click', () => {
        const x = parseFloat(contextMenu.dataset.x);
        const y = parseFloat(contextMenu.dataset.y);
        
        
        const minDistance = 50;
        let tooClose = false;
        
        for (const node of network.nodes.values()) {
            const dx = x - node.x;
            const dy = y - node.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < minDistance) {
                tooClose = true;
                break;
            }
        }
        
        if (!tooClose) {
            const node = network.addNode(x, y);
            network.selectedNode = node;
            visualization.selectedNode = node;
            visualization.updateNodeDetails(node);
            removeNodeBtn.disabled = false;
            removeNodeBtn.removeAttribute('data-tooltip');
            visualization.render();
            saveState();
        } else {
            alert('Cannot add node: Too close to existing nodes');
        }
        
        contextMenu.style.display = 'none';
    });

    
    const pathFinderContainer = document.createElement('div');
    pathFinderContainer.className = 'path-finder-container';
    pathFinderContainer.innerHTML = `
        <div class="path-finder-header">Find Shortest Path</div>
        <div class="path-finder-content">
            <div class="path-finder-info">Complete LSA flooding to enable path finding</div>
            <div class="path-finder-row">
                <label for="sourceNodeSelect">Source:</label>
                <select id="sourceNodeSelect" disabled></select>
            </div>
            <div class="path-finder-row">
                <label for="destNodeSelect">Destination:</label>
                <select id="destNodeSelect" disabled></select>
            </div>
            <button id="findPathBtn" disabled>Find Path</button>
            <button id="clearPathBtn" disabled>Clear</button>
        </div>
    `;

    
    const pathFinderStyle = document.createElement('style');
    pathFinderStyle.textContent = `
        .path-finder-container {
            position: absolute;
            top: 65px; 
            left: 10px; 
            background-color: #2d2d2d;
            border: 1px solid #4CAF50;
            border-radius: 4px;
            padding: 10px;
            width: 240px;
            z-index: 100;
        }
        
        .path-finder-header {
            font-weight: bold;
            margin-bottom: 10px;
            color: #fff;
        }
        
        .path-finder-content {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .path-finder-info {
            color: #ff9800;
            font-size: 12px;
            margin-bottom: 5px;
            text-align: center;
        }
        
        .path-finder-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .path-finder-row label {
            color: #fff;
            margin-right: 10px;
        }
        
        .path-finder-row select {
            flex: 1;
            padding: 4px;
            background-color: #3d3d3d;
            color: #fff;
            border: 1px solid #555;
            border-radius: 3px;
        }
        
        .path-finder-row select:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        #findPathBtn, #clearPathBtn {
            padding: 6px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            margin-top: 5px;
        }
        
        #findPathBtn:disabled, #clearPathBtn:disabled {
            background-color: #555;
            cursor: not-allowed;
            opacity: 0.7;
        }
        
        #clearPathBtn {
            background-color: #f44336;
        }
        
        #findPathBtn:hover:not(:disabled), #clearPathBtn:hover:not(:disabled) {
            opacity: 0.9;
        }
    `;

    document.body.appendChild(pathFinderContainer);
    document.head.appendChild(pathFinderStyle);

    
    function updateNodeSelectors() {
        const sourceSelect = document.getElementById('sourceNodeSelect');
        const destSelect = document.getElementById('destNodeSelect');
        
        
        const currentSource = sourceSelect.value;
        const currentDest = destSelect.value;
        
        
        sourceSelect.innerHTML = '';
        destSelect.innerHTML = '';
        
        
        for (const nodeId of network.nodes.keys()) {
            const sourceOption = document.createElement('option');
            sourceOption.value = nodeId;
            sourceOption.text = `Router ${nodeId}`;
            sourceSelect.appendChild(sourceOption);
            
            const destOption = document.createElement('option');
            destOption.value = nodeId;
            destOption.text = `Router ${nodeId}`;
            destSelect.appendChild(destOption);
        }
        
        
        if (currentSource && [...network.nodes.keys()].includes(parseInt(currentSource))) {
            sourceSelect.value = currentSource;
        }
        
        if (currentDest && [...network.nodes.keys()].includes(parseInt(currentDest))) {
            destSelect.value = currentDest;
        }
    }

    
    document.getElementById('findPathBtn').addEventListener('click', () => {
        
        if (!network.isSimulationComplete) {
            alert('Cannot find path: Complete LSA flooding first');
            return;
        }
        
        const sourceId = parseInt(document.getElementById('sourceNodeSelect').value);
        const destId = parseInt(document.getElementById('destNodeSelect').value);
        
        if (sourceId === destId) {
            alert('Source and destination cannot be the same');
            return;
        }
        
        visualization.findAndShowPath(sourceId, destId);
    });

    document.getElementById('clearPathBtn').addEventListener('click', () => {
        visualization.clearPath();
    });

    
    const origAddNode = network.addNode;
    network.addNode = function(x, y) {
        const node = origAddNode.call(this, x, y);
        updateNodeSelectors();
        return node;
    };

    const origRemoveNode = network.removeNode;
    network.removeNode = function(nodeId) {
        origRemoveNode.call(this, nodeId);
        updateNodeSelectors();
    };

    
    setTimeout(updateNodeSelectors, 0);

    
    window.addEventListener('load', () => {
        
        document.querySelectorAll('[title]').forEach(el => {
            if (el.title) {
                el.setAttribute('data-tooltip', el.title);
                el.removeAttribute('title');
            }
        });

        
        network.simulationPhase = null;
        network.helloPhaseComplete = false;
        network.lsaPhaseComplete = false;
        network.isSimulationRunning = false;
        network.isSimulationComplete = false;
        
        
        if (startHelloBtn) {
            startHelloBtn.innerHTML = '<i class="fas fa-play"></i> Start Hello Phase';
            startHelloBtn.classList.remove('active');
            startHelloBtn.disabled = false;
            startHelloBtn.removeAttribute('data-tooltip');
        }
        
        if (startLSABtn) {
            startLSABtn.innerHTML = '<i class="fas fa-play"></i> Start Flooding';
            startLSABtn.classList.remove('active');
            startLSABtn.disabled = true;
            updateDisabledButtonTooltip(startLSABtn, 'Complete Hello Phase first');
        }
        
        if (pauseSimulationBtn) {
            pauseSimulationBtn.innerHTML = '<i class="fas fa-pause"></i> Pause';
            pauseSimulationBtn.classList.remove('active');
            pauseSimulationBtn.disabled = true;
            updateDisabledButtonTooltip(pauseSimulationBtn, 'Simulation is paused');
        }
        
        
        const pathFinderInfo = document.querySelector('.path-finder-info');
        if (pathFinderInfo) {
            pathFinderInfo.textContent = 'Complete LSA flooding to enable path finding';
            pathFinderInfo.style.color = '#ff9800';
        }
        
        const sourceSelect = document.getElementById('sourceNodeSelect');
        const destSelect = document.getElementById('destNodeSelect');
        const findPathBtn = document.getElementById('findPathBtn');
        const clearPathBtn = document.getElementById('clearPathBtn');
        
        if (sourceSelect) sourceSelect.disabled = true;
        if (destSelect) destSelect.disabled = true;
        if (findPathBtn) findPathBtn.disabled = true;
        if (clearPathBtn) clearPathBtn.disabled = true;
        
        
        if (visualization) {
            visualization.clearPath();
        }
        
        network.logger.log('SYSTEM', 'Page refreshed, simulation states reset');
    });

    
    resetSimulationBtn.addEventListener('click', () => {
        if (!network.isSimulationRunning && confirm('Reset simulation state? This will keep your network topology but clear all simulation data.')) {
            
            resetSimulationState();
            
            network.logger.log('NETWORK', 'Simulation state reset, network topology preserved');
        }
    });
    
    
    function resetSimulationState() {
        
        network.helloPackets = [];
        network.lsaPackets = [];
        
        
        network.isSimulationRunning = false;
        network.isSimulationComplete = false;
        network.simulationPhase = null;
        network.helloPhaseComplete = false;
        network.lsaPhaseComplete = false;
        
        
        for (const node of network.nodes.values()) {
            node.lsa_seq = 0;
            node.lsa_db = {};
            node.receivedLSAs = new Set();
            node.forwardedTo = new Map();
            node.routingTable.clear();
            node.isActive = false;
        }
        
        
        startHelloBtn.innerHTML = '<i class="fas fa-play"></i> Start Hello Phase';
        startHelloBtn.classList.remove('active');
        startHelloBtn.disabled = false;
        startHelloBtn.removeAttribute('data-tooltip');
        
        startLSABtn.innerHTML = '<i class="fas fa-play"></i> Start Flooding';
        startLSABtn.classList.remove('active');
        startLSABtn.disabled = true;
        updateDisabledButtonTooltip(startLSABtn, 'Complete Hello Phase first');
        
        pauseSimulationBtn.innerHTML = '<i class="fas fa-pause"></i> Pause';
        pauseSimulationBtn.classList.remove('active');
        pauseSimulationBtn.disabled = true;
        updateDisabledButtonTooltip(pauseSimulationBtn, 'Simulation is paused');
        
        
        const pathFinderInfo = document.querySelector('.path-finder-info');
        if (pathFinderInfo) {
            pathFinderInfo.textContent = 'Complete LSA flooding to enable path finding';
            pathFinderInfo.style.color = '#ff9800';
        }
        
        const sourceSelect = document.getElementById('sourceNodeSelect');
        const destSelect = document.getElementById('destNodeSelect');
        const findPathBtn = document.getElementById('findPathBtn');
        const clearPathBtn = document.getElementById('clearPathBtn');
        
        if (sourceSelect) sourceSelect.disabled = true;
        if (destSelect) destSelect.disabled = true;
        if (findPathBtn) findPathBtn.disabled = true;
        if (clearPathBtn) clearPathBtn.disabled = true;
        
        
        visualization.clearPath();
        
        
        if (network.selectedNode) {
            visualization.updateNodeDetails(network.selectedNode);
        }
        
        
        visualization.render();
    }
}); 