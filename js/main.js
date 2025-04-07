document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('networkCanvas');
    const network = new Network();
    const visualization = new Visualization(canvas, network);
    
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
            }
        }
        
        for (const nodeData of state.nodes){
            const node = nodeMap.get(nodeData.id);
            if (node){
                for (const neighbor of nodeData.neighbors){
                    const neighborNode = nodeMap.get(neighbor.id);
                    if (neighborNode){
                        node.neighbors.set(neighbor.id, { weight: neighbor.weight });
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
    const edgeTypeSelector = document.getElementById('edgeTypeSelector');
    const undoButton = document.getElementById('undoButton');
    const redoButton = document.getElementById('redoButton');
    
    
    const addNodeBtn = document.getElementById('addNode');
    const addEdgeBtn = document.getElementById('addEdge');
    const removeNodeBtn = document.getElementById('removeNode');

    
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

        
        if (network.simulationPhase !== 'lsa' && !network.helloPhaseComplete){
            routingTableDiv.innerHTML = '<div class="no-route">Routing tables will be available after Hello phase completes</div>';
            return;
        }

        let html = '';
        if (node.routingTable.size === 0){
            html = '<div class="no-route">No routes available</div>';
        } else {
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
                            <div class="route-next-hop">
                                Next Hop: ${route.nextHop ? `Router ${route.nextHop}` : 'None'}
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
        
        const confirmBtn = document.getElementById('confirmWeight');
        confirmBtn.onclick = () => {
            const weight = parseInt(weightInput.value);
            if (!isNaN(weight) && weight > 0){
                callback(weight);
                hideWeightDialog();
            } else {
                alert('Please enter a valid positive number for the weight.');
            }
        };
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
        if (network.isSimulationRunning){
            
            network.stopSimulation();
            startHelloBtn.innerHTML = '<i class="fas fa-play"></i> Start Hello Phase';
            startHelloBtn.classList.remove('active');
            startLSABtn.disabled = true;
            updateDisabledButtonTooltip(startLSABtn, 'Complete Hello Phase first');
            
            
            addNodeBtn.disabled = false;
            addEdgeBtn.disabled = false;
            clearNetworkBtn.disabled = false;
            resetViewBtn.disabled = false;
            removeNodeBtn.disabled = !network.selectedNode;
            
            
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
            startHelloBtn.setAttribute('title', 'Start Hello Phase (Space)');
        } else {
            
            network.startHelloPhase();
            startHelloBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Hello Phase';
            startHelloBtn.classList.add('active');
            startLSABtn.disabled = true;
            updateDisabledButtonTooltip(startLSABtn, 'Hello Phase is running');
            
            
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
            startHelloBtn.setAttribute('title', 'Stop Hello Phase (Space)');
        }
    });

    
    startLSABtn.addEventListener('click', () => {
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
            startLSABtn.setAttribute('title', 'Start LSA Flooding');
        } else {
            
            network.startLSAPhase();
            startLSABtn.innerHTML = '<i class="fas fa-stop"></i> Stop Flooding';
            startLSABtn.classList.add('active');
            startHelloBtn.disabled = true;
            updateDisabledButtonTooltip(startHelloBtn, 'LSA Flooding is running');
            
            
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
            startLSABtn.setAttribute('title', 'Stop LSA Flooding');
        }
    });

    
    clearNetworkBtn.addEventListener('click', () => {
        if (!network.isSimulationRunning && confirm('Are you sure you want to clear the network?')){
            
            network.nodes.clear();
            network.selectedNode = null;
            network.helloPackets = [];
            network.lsaPackets = [];
            network.isSimulationRunning = false;
            network.nextNodeId = 1;
            
            
            startHelloBtn.innerHTML = '<i class="fas fa-play"></i> Start Hello Phase';
            startHelloBtn.classList.remove('active');
            startLSABtn.innerHTML = '<i class="fas fa-play"></i> Start Flooding';
            startLSABtn.classList.remove('active');
            startLSABtn.disabled = true;
            updateDisabledButtonTooltip(startLSABtn, 'Complete Hello Phase first');
            
            
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
            startHelloBtn.disabled = false;
            
            
            document.getElementById('nodeInfo').innerHTML = 'No node selected';
            document.getElementById('routingTable').innerHTML = 'No routing information available';
            
            
            visualization.updateNodeDetails(null);
            visualization.render();
            
            
            visualization.resetView();
            
            
            saveState();
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
                sourceNode.neighbors.delete(targetId);
                
                
                const targetNode = network.nodes.get(targetId);
                if (targetNode && targetNode.neighbors.has(sourceId)){
                    targetNode.neighbors.delete(sourceId);
                }
                
                
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
                showWeightDialog((weight) => {
                    sourceNode.neighbors.set(targetId, { weight });
                    
                    
                    if (targetNode.neighbors.has(sourceId)){
                        targetNode.neighbors.set(sourceId, { weight });
                    }
                    
                    
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
                startHelloBtn.click();
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

    
    function animate(){
        if (network.isSimulationRunning){
            network.simulationStep();
            
            
            if (network.selectedNode){
                visualization.updateNodeDetails(network.selectedNode);
            }
            
            
            if (network.simulationPhase === 'hello' && network.helloPhaseComplete){
                startHelloBtn.innerHTML = '<i class="fas fa-play"></i> Start Hello Phase';
                startHelloBtn.classList.remove('active');
                startLSABtn.disabled = false;
                startLSABtn.removeAttribute('data-tooltip');
                network.isSimulationRunning = false;
                
                
                network.updateRoutingTables();
                
                
                if (network.selectedNode){
                    visualization.updateNodeDetails(network.selectedNode);
                }
                
                canvas.style.cursor = 'grab'; 
                network.logger.log('NETWORK', 'Hello phase complete, routing tables generated');
                
                
                updateButtonStates(false);
            }
            
            
            if (network.simulationPhase === 'lsa' && network.lsaPhaseComplete){
                startLSABtn.innerHTML = '<i class="fas fa-play"></i> Start Flooding';
                startLSABtn.classList.remove('active');
                startHelloBtn.disabled = false;
                network.isSimulationRunning = false;
                canvas.style.cursor = 'grab'; 
                
                
                updateButtonStates(false);
            }
        }
        visualization.render();
        requestAnimationFrame(animate);
    }
    animate();
}); 