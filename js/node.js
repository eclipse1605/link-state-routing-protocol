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
        this.lsa_seq = 0;  // Per-node sequence number
        this.lsa_db = {};  // LSA database
        this.lsa_age = new Map();  // Track LSA ages
        this.received_lsas = new Set();  // Track received LSAs
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
        // Generate new LSA when topology changes
        this.lsa_seq++;
    }

    updateNeighborWeight(nodeId, newWeight) {
        if (this.neighbors.has(nodeId)) {
            this.neighbors.get(nodeId).weight = newWeight;
            this.neighbors.get(nodeId).lastUpdate = Date.now();
            // Generate new LSA when topology changes
            this.lsa_seq++;
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

    processLSA(lsa) {
        const key = `${lsa.sourceId}-${lsa.sequenceNumber}`;
        
        // Check if we've seen this LSA before
        if (this.received_lsas.has(key)) {
            return false;
        }
        
        // Check if this is a newer LSA
        const currentLSA = this.lsa_db[lsa.sourceId];
        if (currentLSA && currentLSA.sequenceNumber >= lsa.sequenceNumber) {
            return false;
        }
        
        // Only process LSAs from our actual neighbors or if we're directly connected to the source
        if (!this.neighbors.has(lsa.sourceId)) {
            // If it's not from a direct neighbor, check if it's a valid LSA we should process
            let isValidSource = false;
            for (const neighbor of lsa.neighbors) {
                if (this.neighbors.has(neighbor.nodeId)) {
                    isValidSource = true;
                    break;
                }
            }
            if (!isValidSource) {
                return false;
            }
        }
        
        // Store the LSA
        this.received_lsas.add(key);
        this.lsa_db[lsa.sourceId] = lsa;
        this.lsa_age.set(key, 0);
        
        // Only forward if we have other neighbors to forward to
        return this.neighbors.size > 1;
    }

    generateLSA() {
        this.lsa_seq++;
        return {
            sourceId: this.id,
            sequenceNumber: this.lsa_seq,
            neighbors: Array.from(this.neighbors.entries())
                .map(([id, data]) => ({ nodeId: id, weight: data.weight })),
            age: 0
        };
    }
} 