class Node {
    constructor(id, x, y) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.radius = 20;
        this.neighbors = new Map(); 
        this.routingTable = new Map(); 
        this.lastHelloTime = 0;
        this.isSelected = false;
        this.helloInterval = 5000; 
        this.neighborTimeout = 15000; 
        this.isActive = true;
        this.lsa_seq = 0;
        this.lsa_db = {};
    }

    get isIsolated() {
        return this.neighbors.size === 0;
    }

    addNeighbor(nodeId, weight) {
        this.neighbors.set(nodeId, {
            weight: weight,
            lastUpdate: Date.now()
        });
        
    }

    removeNeighbor(nodeId) {
        this.neighbors.delete(nodeId);
        
    }

    updateNeighborWeight(nodeId, newWeight) {
        if (this.neighbors.has(nodeId)) {
            this.neighbors.get(nodeId).weight = newWeight;
            this.neighbors.get(nodeId).lastUpdate = Date.now();
            
        }
    }

    updateRoutingTable() {
        
        this.routingTable.clear();
        
        
        for (const [neighborId, data] of this.neighbors) {
            this.routingTable.set(neighborId, {
                nextHop: neighborId,
                cost: data.weight,
                path: [this.id, neighborId]
            });
        }
    }

    sendHelloPacket() {
        const currentTime = Date.now();
        if (currentTime - this.lastHelloTime >= this.helloInterval) {
            this.lastHelloTime = currentTime;
            return {
                sourceId: this.id,
                timestamp: currentTime,
                neighbors: Array.from(this.neighbors.entries()).map(([id, data]) => ({
                    nodeId: id,
                    weight: data.weight
                }))
            };
        }
        return null;
    }

    processHelloPacket(packet) {
        const currentTime = Date.now();
        const sourceId = packet.sourceId;

        
        
        
        
        
        if (this.neighbors.has(sourceId)) {
            const existingNeighbor = this.neighbors.get(sourceId);
            existingNeighbor.lastUpdate = currentTime;
            
            
            if (!this.lsa_db[sourceId] || !this.lsa_db[sourceId].neighbors) {
                this.lsa_db[sourceId] = {
                    seq: 1,
                    neighbors: packet.neighbors,
                    timestamp: currentTime
                };
            }
        }
        
        
        
        

        
        for (const [nodeId, data] of this.neighbors) {
            if (currentTime - data.lastUpdate > this.neighborTimeout) {
                this.neighbors.delete(nodeId);
            }
        }
    }

    getDetails() {
        return {
            id: this.id,
            position: { x: this.x, y: this.y },
            neighbors: Array.from(this.neighbors.entries()).map(([id, data]) => ({
                nodeId: id,
                weight: data.weight
            })),
            routingTable: Array.from(this.routingTable.entries()).map(([id, data]) => ({
                destination: id,
                nextHop: data.nextHop,
                cost: data.cost,
                path: data.path
            }))
        };
    }

    processLSA(sourceId, sequenceNumber, neighbors) {
        
        if (!this.lsa_db[sourceId] || this.lsa_db[sourceId].seq < sequenceNumber) {
            
            
            this.lsa_db[sourceId] = {
                seq: sequenceNumber,
                neighbors: neighbors, 
                timestamp: Date.now()
            };
            return true; 
        }
        return false; 
    }

    generateLSA() {
        
        this.lsa_seq++;
        const neighbors = {};
        for (const [neighborId, data] of this.neighbors) {
            neighbors[neighborId] = data.weight;
        }
        return {
            sourceId: this.id,
            sequenceNumber: this.lsa_seq,
            neighbors: neighbors
        };
    }
} 