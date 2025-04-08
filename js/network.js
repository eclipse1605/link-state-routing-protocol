class Network {
    constructor() {
        this.nodes = new Map();
        this.nextNodeId = 1;
        this.selectedNode = null;
        this.helloPackets = [];
        this.lsaPackets = [];
        this.lastUpdateTime = Date.now();
        this.updateInterval = 1000; 
        this.isSimulationRunning = false;
        this.lsaSequenceNumber = 1;
        this.logger = new Logger();
        this.logger.log('NETWORK', 'Network initialized');
        this.lastRoutingState = new Map(); 
        this.convergenceCounter = 0; 
        this.isConverged = false;
        
        this.simulationPhase = 'none'; 
        this.currentNodeIndex = 0;
        this.nodesInOrder = []; 
        this.helloPhaseComplete = false;
        this.lsaPhaseComplete = false;
        this.isPaused = false;
        this.maxAge = 0;  // Will be set based on network size
    }

    addNode(x, y, explicitId = null) {
        
        const id = explicitId !== null ? explicitId : this.nextNodeId++;
        
        
        if (explicitId !== null && explicitId >= this.nextNodeId) {
            this.nextNodeId = explicitId + 1;
        }
        
        const node = new Node(id, x, y);
        this.nodes.set(node.id, node);
        
        
        this.logger.log('NODE', `Added Router ${node.id}`, { position: { x, y } });
        return node;
    }

    connectNodes(node1Id, node2Id, weight, isBidirectional = true) {
        const node1 = this.nodes.get(node1Id);
        const node2 = this.nodes.get(node2Id);
        
        if (!node1 || !node2) {
            this.logger.log('ERROR', `Failed to connect nodes: Invalid node IDs ${node1Id}, ${node2Id}`);
            return false;
        }
        if (node1.neighbors.has(node2Id)) {
            this.logger.log('ERROR', `Edge already exists between Router ${node1Id} and Router ${node2Id}`);
            return false;
        }
        
        node1.neighbors.set(node2Id, { weight: weight });
        node1.lsa_seq++;
        node1.lsa_db[node2Id] = { weight: weight, timestamp: Date.now() };
        
        if (isBidirectional) {
            node2.neighbors.set(node1Id, { weight: weight });
            node2.lsa_seq++;
            node2.lsa_db[node1Id] = { weight: weight, timestamp: Date.now() };
        }
        
        this.logger.log('EDGE', `Connected Router ${node1Id} to Router ${node2Id}`, { 
            weight, 
            bidirectional: isBidirectional 
        });
        return true;
    }

    updateEdgeWeight(node1Id, node2Id, weight) {
        const node1 = this.nodes.get(node1Id);
        const node2 = this.nodes.get(node2Id);
        
        if (!node1 || !node2) {
            this.logger.log('ERROR', `Failed to update edge weight: Invalid node IDs ${node1Id}, ${node2Id}`);
            return false;
        }
        if (!node1.neighbors.has(node2Id)) {
            this.logger.log('ERROR', `No edge exists between Router ${node1Id} and Router ${node2Id}`);
            return false;
        }
        
        const oldWeight = node1.neighbors.get(node2Id).weight;
        
        node1.neighbors.get(node2Id).weight = weight;
        node1.lsa_seq++;
        node1.lsa_db[node2Id] = { weight: weight, timestamp: Date.now() };
        
        
        if (node2.neighbors.has(node1Id)) {
            node2.neighbors.get(node1Id).weight = weight;
            node2.lsa_seq++;
            node2.lsa_db[node1Id] = { weight: weight, timestamp: Date.now() };
        }
        
        this.updateRoutingTables();
        this.logger.log('EDGE', `Updated edge weight between Router ${node1Id} and Router ${node2Id}`, 
            { oldWeight, newWeight: weight });
        return true;
    }

    disconnectNodes(node1Id, node2Id) {
        const node1 = this.nodes.get(node1Id);
        const node2 = this.nodes.get(node2Id);
        
        if (!node1 || !node2) {
            this.logger.log('ERROR', `Failed to disconnect nodes: Invalid node IDs ${node1Id}, ${node2Id}`);
            return false;
        }
        
        const weight = node1.neighbors.get(node2Id)?.weight;
        const bidirectional = node2.neighbors.has(node1Id);
        
        node1.neighbors.delete(node2Id);
        node1.lsa_seq++;
        delete node1.lsa_db[node2Id];
        
        if (bidirectional) {
            node2.neighbors.delete(node1Id);
            node2.lsa_seq++;
            delete node2.lsa_db[node1Id];
        }
        
        this.updateRoutingTables();
        this.logger.log('EDGE', `Disconnected Router ${node1Id} from Router ${node2Id}`, { 
            removedWeight: weight,
            bidirectional: bidirectional
        });
        return true;
    }

    startHelloPhase() {
        // Clear all packets and state from previous phases
        this.helloPackets = [];
        this.lsaPackets = [];
        this.lsaSeenMap = new Map();
        this.lsaSequenceNumber = 1;
        
        // Reset simulation state
        this.simulationPhase = 'hello';
        this.isSimulationRunning = true;
        this.isPaused = false;
        this.nodesInOrder = Array.from(this.nodes.values());
        this.currentNodeIndex = 0;
        this.helloPhaseComplete = false;
        this.lsaPhaseComplete = false;  // Ensure LSA phase is marked as not complete
        
        // Preserve the network topology but reset routing tables
        for (const node of this.nodes.values()) {
            node.routingTable.clear();
            node.isActive = true;
        }
        
        this.logger.log('NETWORK', 'Starting Hello packet phase');
    }

    startLSAPhase() {
        this.simulationPhase = 'lsa';
        this.isSimulationRunning = true;
        this.isPaused = false;
        this.lsaPackets = [];
        this.lsaPhaseComplete = false;
        
        // Reset LSA state for all nodes
        for (const node of this.nodes.values()) {
            node.lsa_db = {};  // Clear LSA database
            node.received_lsas = new Set();  // Track which LSAs we've seen
        }
        
        // Each router creates its initial LSA and sends to neighbors
        for (const node of this.nodes.values()) {
            // Create LSA containing router ID and neighbor information
            const lsa = {
                sourceId: node.id,  // Router ID
                sequenceNumber: 1,   // First LSA from this router
                neighbors: Array.from(node.neighbors.entries())
                    .map(([neighborId, data]) => ({
                        id: neighborId,
                        cost: data.weight
                    }))
            };
            
            // Router stores its own LSA
            node.lsa_db[node.id] = lsa;
            node.received_lsas.add(`${node.id}-1`);
            
            // Send to all neighbors
            for (const [neighborId, _] of node.neighbors) {
                this.lsaPackets.push({
                    lsa: lsa,
                    targetId: neighborId,
                    receivedFrom: node.id,
                    progress: 0
                });
            }
        }
        
        this.logger.log('NETWORK', 'Starting LSA flooding phase');
    }

    stopSimulation() {
        this.isSimulationRunning = false;
        this.isPaused = false;
        this.logger.log('NETWORK', `Stopped ${this.simulationPhase} phase`);
    }

    pauseSimulation() {
        if (this.isSimulationRunning) {
            this.isPaused = !this.isPaused;
            
            
            if (this.isPaused) {
                
                for (const node of this.nodes.values()) {
                    const newRoutingTable = this.calculateShortestPaths(node.id);
                    node.routingTable = newRoutingTable;
                }
                
                
                if (this.selectedNode) {
                    this.selectedNodeNeedsUpdate = true;
                }
            }
            
            this.logger.log('NETWORK', this.isPaused ? 
                `Paused ${this.simulationPhase} phase` : 
                `Resumed ${this.simulationPhase} phase`);
            return this.isPaused;
        }
        return false;
    }

    simulationStep() {
        if (!this.isSimulationRunning || this.isPaused) return;

        if (this.simulationPhase === 'hello') {
            this.processHelloPhase();
        } else if (this.simulationPhase === 'lsa') {
            this.processLSAPhase();
        }

        this.updatePackets();
    }

    processHelloPhase() {
        if (this.helloPhaseComplete) {
            this.stopSimulation();
            this.logger.log('NETWORK', 'Hello phase complete, ready for routing table updates');
            return;
        }

        if (this.helloPackets.length === 0) {
            const currentNode = this.nodesInOrder[this.currentNodeIndex];
            if (currentNode && currentNode.isActive) {
                for (const [neighborId, data] of currentNode.neighbors) {
                    // Send hello packet
                    this.helloPackets.push({
                        sourceId: currentNode.id,
                        targetId: neighborId,
                        progress: 0,
                        type: 'hello'
                    });
                    
                    // Ensure the reverse connection is maintained
                    const neighborNode = this.nodes.get(neighborId);
                    if (neighborNode && !neighborNode.neighbors.has(currentNode.id)) {
                        neighborNode.neighbors.set(currentNode.id, { weight: data.weight });
                        neighborNode.lsa_seq++;
                        neighborNode.lsa_db[currentNode.id] = { weight: data.weight, timestamp: Date.now() };
                    }
                    
                    this.logger.log('PACKET', `Hello packet sent from Router ${currentNode.id} to Router ${neighborId}`);
                }
            }

            this.currentNodeIndex++;
            if (this.currentNodeIndex >= this.nodesInOrder.length) {
                if (this.helloPackets.length === 0) {
                    this.helloPhaseComplete = true;
                }
            }
        }
    }

    processLSAPhase() {
        if (this.lsaPhaseComplete) {
            this.stopSimulation();
            this.logger.log('NETWORK', 'LSA flooding phase complete');
            return;
        }

        // Process all LSA packets
        for (let i = this.lsaPackets.length - 1; i >= 0; i--) {
            const packet = this.lsaPackets[i];
            packet.progress += 0.01;
            
            if (packet.progress >= 1) {
                const targetNode = this.nodes.get(packet.targetId);
                
                // Only process if target exists
                if (targetNode) {
                    const lsa = packet.lsa;
                    const key = `${lsa.sourceId}-${lsa.sequenceNumber}`;
                    
                    // If we haven't seen this LSA before
                    if (!targetNode.received_lsas.has(key)) {
                        // Store the LSA
                        targetNode.received_lsas.add(key);
                        targetNode.lsa_db[lsa.sourceId] = lsa;
                        
                        // Forward to all neighbors except the one we got it from
                        for (const [neighborId, _] of targetNode.neighbors) {
                            if (neighborId !== packet.receivedFrom) {
                                this.lsaPackets.push({
                                    lsa: lsa,
                                    targetId: neighborId,
                                    receivedFrom: targetNode.id,
                                    progress: 0
                                });
                            }
                        }
                    }
                }
                
                // Remove processed packet
                this.lsaPackets.splice(i, 1);
            }
        }

        // Check if flooding is complete (no more packets and all nodes have all LSAs)
        if (this.lsaPackets.length === 0) {
            const complete = Array.from(this.nodes.values()).every(node => {
                // Each node should have LSAs from every other node
                return Array.from(this.nodes.keys()).every(otherId => 
                    // Skip self or inactive nodes
                    otherId === node.id || node.lsa_db[otherId] !== undefined
                );
            });
            
            if (complete) {
                // All nodes have complete topology - calculate routes
                for (const node of this.nodes.values()) {
                    node.routingTable = this.calculateShortestPaths(node.id);
                }
                this.lsaPhaseComplete = true;
                this.logger.log('NETWORK', 'All nodes have complete topology information');
            }
        }
    }

    updatePackets() {
        // Process hello packets
        for (let i = this.helloPackets.length - 1; i >= 0; i--) {
            const packet = this.helloPackets[i];
            packet.progress += 0.01;
            
            if (packet.progress >= 1) {
                const targetNode = this.nodes.get(packet.targetId);
                if (targetNode) {
                    const sourceNode = this.nodes.get(packet.sourceId);
                    if (sourceNode) {
                        const sourceNeighbors = Array.from(sourceNode.neighbors.entries())
                            .map(([id, data]) => ({ nodeId: id, weight: data.weight }));
                        
                        targetNode.processHelloPacket({
                            sourceId: packet.sourceId,
                            timestamp: Date.now(),
                            neighbors: sourceNeighbors
                        });
                    }
                }
                this.helloPackets.splice(i, 1);
                this.logger.log('PACKET', `Hello packet from Router ${packet.sourceId} to Router ${packet.targetId} delivered`);
            }
        }

        // Process LSA packets is now handled in processLSAPhase
    }

    updateRoutingTables() {
        let hasChanges = false;
        const currentState = new Map();

        for (const node of this.nodes.values()) {
            const oldTable = new Map(node.routingTable);
            node.updateRoutingTable();
            
            
            currentState.set(node.id, new Map(node.routingTable));
            
            
            for (const [destId, newRoute] of node.routingTable) {
                const oldRoute = oldTable.get(destId);
                if (!oldRoute || 
                    oldRoute.nextHop !== newRoute.nextHop || 
                    oldRoute.cost !== newRoute.cost ||
                    !this.arraysEqual(oldRoute.path, newRoute.path)) {
                    hasChanges = true;
                    this.logger.log('ROUTING', `Router ${node.id} updated route to Router ${destId}`, {
                        nextHop: newRoute.nextHop,
                        cost: newRoute.cost,
                        path: newRoute.path
                    });
                }
            }
        }

        
        this.lastRoutingState = currentState;
        return hasChanges;
    }

    createLSA(sourceId, targetId) {
        const sourceNode = this.nodes.get(sourceId);
        const targetNode = this.nodes.get(targetId);
        
        if (!sourceNode || !targetNode) {
            this.logger.log('ERROR', `Failed to create LSA: Invalid node IDs ${sourceId}, ${targetId}`);
            return;
        }

        const lsaPacket = {
            sourceId: sourceId,
            targetId: targetId,
            progress: 0,
            sequenceNumber: this.lsaSequenceNumber++,
            timestamp: Date.now()
        };

        this.lsaPackets.push(lsaPacket);
        this.logger.log('PACKET', `LSA packet #${lsaPacket.sequenceNumber} created from Router ${sourceId} to Router ${targetId}`);
    }

    getNodeAtPosition(x, y, radius = 20) {
        for (const node of this.nodes.values()) {
            const dx = x - node.x;
            const dy = y - node.y;
            if (dx * dx + dy * dy <= radius * radius) {
                return node;
            }
        }
        return null;
    }

    edgeExists(node1Id, node2Id) {
        const node1 = this.nodes.get(node1Id);
        
        
        return node1 && node1.neighbors.has(node2Id);
    }

    removeNode(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node) {
            this.logger.log('ERROR', `Failed to remove node: Invalid node ID ${nodeId}`);
            return;
        }

        
        for (const [neighborId, data] of node.neighbors) {
            this.logger.log('EDGE', `Removing edge between Router ${nodeId} and Router ${neighborId}`, 
                { weight: data.weight });
        }

        
        for (const [neighborId, _] of node.neighbors) {
            const neighbor = this.nodes.get(neighborId);
            if (neighbor) {
                neighbor.neighbors.delete(nodeId);
            }
        }

        
        this.nodes.delete(nodeId);
        this.logger.log('NODE', `Removed Router ${nodeId}`);

        
        this.updateRoutingTables();

        
        if (this.selectedNode === node) {
            this.selectedNode = null;
        }

        
        this.helloPackets = this.helloPackets.filter(p => 
            p.sourceId !== nodeId && p.targetId !== nodeId
        );
        this.lsaPackets = this.lsaPackets.filter(p => 
            p.sourceId !== nodeId && p.targetId !== nodeId
        );
    }

    calculateShortestPaths(sourceId) {
        const distances = new Map();
        const previous = new Map();
        const unvisited = new Set();
        const routingTable = new Map();

        
        for (const [nodeId] of this.nodes) {
            distances.set(nodeId, Infinity);
            unvisited.add(nodeId);
        }
        distances.set(sourceId, 0);

        while (unvisited.size > 0) {
            
            let minDistance = Infinity;
            let current = null;
            for (const nodeId of unvisited) {
                if (distances.get(nodeId) < minDistance) {
                    minDistance = distances.get(nodeId);
                    current = nodeId;
                }
            }

            if (current === null || minDistance === Infinity) break;
            unvisited.delete(current);

            const currentNode = this.nodes.get(current);
            
            for (const [neighborId, data] of currentNode.neighbors) {
                if (!unvisited.has(neighborId)) continue;
                
                const alt = distances.get(current) + data.weight;
                if (alt < distances.get(neighborId)) {
                    distances.set(neighborId, alt);
                    previous.set(neighborId, current);
                }
            }
        }

        
        for (const [nodeId] of this.nodes) {
            if (nodeId === sourceId) continue;
            
            const path = [];
            let current = nodeId;
            let nextHop = null;
            
            while (current !== null && current !== sourceId) {
                path.unshift(current);
                if (nextHop === null) nextHop = current;
                current = previous.get(current);
                if (current === undefined) {
                    path.length = 0;
                    nextHop = null;
                    break;
                }
            }
            
            if (path.length > 0) {
                path.unshift(sourceId);
                routingTable.set(nodeId, {
                    cost: distances.get(nodeId),
                    path: path,
                    nextHop: nextHop
                });
            }
        }

        return routingTable;
    }

    arraysEqual(a, b) {
        if (!a || !b) return false;
        if (a.length !== b.length) return false;
        return a.every((val, index) => val === b[index]);
    }

    resetSimulationState(clearRoutingTables = true) {
        // Reset only simulation-specific state
        this.simulationPhase = 'none';
        this.currentNodeIndex = 0;
        this.nodesInOrder = [];
        this.helloPhaseComplete = false;
        this.lsaPhaseComplete = false;
        this.helloPackets = [];
        this.lsaPackets = [];
        this.convergenceCounter = 0;
        this.isConverged = false;
        this.lsaSeenMap = new Map();
        this.isPaused = false;
        
        // Optionally clear routing tables without affecting network topology
        if (clearRoutingTables) {
            for (const node of this.nodes.values()) {
                node.routingTable.clear();
                node.isActive = true;
            }
        }
        
        this.logger.log('NETWORK', 'Simulation state reset');
    }

    // Add this helper method to determine which nodes are reachable
    getReachableNodes(startNodeId) {
        const visited = new Set();
        const queue = [startNodeId];
        visited.add(startNodeId);
        
        while (queue.length > 0) {
            const currentNodeId = queue.shift();
            const currentNode = this.nodes.get(currentNodeId);
            
            if (currentNode && currentNode.isActive) {
                for (const [neighborId, _] of currentNode.neighbors) {
                    if (!visited.has(neighborId)) {
                        visited.add(neighborId);
                        queue.push(neighborId);
                    }
                }
            }
        }
        
        return visited;
    }
} 