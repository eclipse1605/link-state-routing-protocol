class Visualization {
    constructor(canvas, network) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.network = network;
        this.scale = 1;
        this.offset = { x: 0, y: 0 };
        this.isDragging = false;
        this.lastMousePos = { x: 0, y: 0 };
        this.selectedNode = null;
        this.edgeCreationState = {
            isActive: false,
            sourceNode: null,
            previewPos: null
        };
        this.phantomNode = null;
        this.isAddingNode = false;
        this.isAddingEdge = false;
        this.defaultScale = 1;
        this.animationFrame = 0;
        this.nodeRadius = 30;
        this.draggedNode = null;
        this.dragOffset = { x: 0, y: 0 };

        
        this.nodeNormalColor = '#4287f5';
        this.nodeHighlightColor = '#f54242';
        this.nodeSelectedColor = '#42f54e';
        this.nodeDragColor = '#f5a742';
        this.nodeIsolatedColor = '#808080'; 

        this.setupEventListeners();
        this.resizeCanvas();
    }

    setupEventListeners() {
        
        window.addEventListener('resize', () => this.resizeCanvas());

        
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('mouseleave', () => {
            this.isDragging = false;
            
            if (this.isAddingNode) {
                this.canvas.style.cursor = 'crosshair';
            } else if (this.edgeCreationState.isActive) {
                this.canvas.style.cursor = 'default';
            } else {
                this.canvas.style.cursor = 'grab';
            }
        });
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        
        
        this.canvas.addEventListener('mouseover', () => {
            if (this.isAddingNode) {
                this.canvas.style.cursor = 'crosshair';
            } else if (!this.edgeCreationState.isActive) {
                this.canvas.style.cursor = 'grab';
            }
        });

        
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));

        
        this.canvas.addEventListener('wheel', (e) => this.handleZoom(e));
    }

    resizeCanvas() {
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
        this.render();
    }

    handleMouseDown(event) {
        if (this.network.isSimulationRunning) return;
        
        const pos = this.getCanvasPosition(event.clientX, event.clientY);
        const clickedNode = this.getNodeAtPosition(pos.x, pos.y);
        
        if (this.edgeCreationState.isActive) {
            if (clickedNode) {
                this.edgeCreationState.sourceNode = clickedNode;
                this.edgeCreationState.previewPos = pos;
                this.render();
            }
        } else if (clickedNode) {
            this.draggedNode = clickedNode;
            this.dragOffset = {
                x: clickedNode.x - pos.x,
                y: clickedNode.y - pos.y
            };
            this.network.selectedNode = clickedNode;
            this.selectedNode = clickedNode;
            this.updateNodeDetails(clickedNode);
            
            
            const removeNodeBtn = document.getElementById('removeNode');
            if (removeNodeBtn) {
                removeNodeBtn.disabled = false;
            }
        } else {
            
            this.isDragging = true;
            this.lastMousePos = { x: event.clientX, y: event.clientY };
            this.canvas.style.cursor = 'grabbing'; 
            
            this.network.selectedNode = null;
            this.selectedNode = null;
            this.updateNodeDetails(null);
            
            
            const removeNodeBtn = document.getElementById('removeNode');
            if (removeNodeBtn) {
                removeNodeBtn.disabled = true;
            }
        }
        this.render();
    }

    handleMouseMove(event) {
        const pos = this.getCanvasPosition(event.clientX, event.clientY);
        const hoverNode = this.getNodeAtPosition(pos.x, pos.y);
        
        if (this.draggedNode) {
            
            this.draggedNode.x = pos.x + this.dragOffset.x;
            this.draggedNode.y = pos.y + this.dragOffset.y;
            
            
            
            this.render();
        } else if (this.edgeCreationState.isActive && this.edgeCreationState.sourceNode) {
            this.edgeCreationState.previewPos = pos;
            this.render();
        } else if (this.isDragging) {
            
            const dx = event.clientX - this.lastMousePos.x;
            const dy = event.clientY - this.lastMousePos.y;
            this.offset.x += dx;
            this.offset.y += dy;
            this.lastMousePos = { x: event.clientX, y: event.clientY };
            this.render();
        } else if (!this.edgeCreationState.isActive && !this.isAddingNode) {
            
            this.canvas.style.cursor = hoverNode ? 'pointer' : 'grab';
        } else if (hoverNode) {
            
            this.canvas.style.cursor = 'pointer';
        }
    }

    handleMouseUp(event) {
        if (this.draggedNode) {
            this.draggedNode = null;
            this.dragOffset = { x: 0, y: 0 };
            return;
        }

        
        this.isDragging = false;
        
        
        if (this.isAddingNode) {
            this.canvas.style.cursor = 'crosshair';
        } else if (this.edgeCreationState.isActive) {
            this.canvas.style.cursor = 'default';
        } else {
            this.canvas.style.cursor = 'grab';
        }

        
        if (this.edgeCreationState.isActive && this.edgeCreationState.sourceNode) {
            const pos = this.getCanvasPosition(event.clientX, event.clientY);
            const targetNode = this.getNodeAtPosition(pos.x, pos.y);
            
            
            if (targetNode && targetNode !== this.edgeCreationState.sourceNode) {
                const sourceId = this.edgeCreationState.sourceNode.id;
                const targetId = targetNode.id;
                
                
                const edgeTypeSelector = document.getElementById('edgeTypeSelector');
                const isBidirectional = edgeTypeSelector.value === 'double';
                
                
                let isRedundant = false;
                
                
                if (isBidirectional) {
                    isRedundant = this.network.edgeExists(sourceId, targetId) || 
                                  this.network.edgeExists(targetId, sourceId);
                } 
                
                else {
                    isRedundant = this.network.edgeExists(sourceId, targetId);
                }
                
                if (!isRedundant) {
                    
                    const weightDialog = document.querySelector('.weight-dialog');
                    const overlay = document.querySelector('.overlay');
                    const weightInput = document.getElementById('weightInput');
                    const confirmBtn = document.getElementById('confirmWeight');
                    
                    weightDialog.style.display = 'block';
                    overlay.style.display = 'block';
                    weightInput.value = '1';
                    weightInput.focus();
                    weightInput.select();
                    
                    const handleConfirm = () => {
                        const weight = parseInt(weightInput.value);
                        if (!isNaN(weight) && weight > 0) {
                            this.network.connectNodes(sourceId, targetId, weight, isBidirectional);
                            this.render();
                            weightDialog.style.display = 'none';
                            overlay.style.display = 'none';
                            
                            if (this.network.selectedNode) {
                                this.updateNodeDetails(this.network.selectedNode);
                            }
                        } else {
                            alert('Please enter a valid positive number for the weight.');
                        }
                    };
                    
                    const newConfirmBtn = confirmBtn.cloneNode(true);
                    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
                    
                    newConfirmBtn.addEventListener('click', handleConfirm);
                    weightInput.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') handleConfirm();
                    });
                } else {
                    
                    this.network.logger.log('ERROR', `Edge already exists between Router ${sourceId} and Router ${targetId}`);
                }
            }
            
            
            this.edgeCreationState = {
                isActive: false,
                sourceNode: null,
                previewPos: null
            };
            
            
            const addEdgeBtn = document.getElementById('addEdge');
            if (addEdgeBtn) {
                addEdgeBtn.innerHTML = '<i class="fas fa-link"></i> Add Edge';
                addEdgeBtn.classList.remove('active');
                document.getElementById('addNode').disabled = false;
            }
            
            this.render();
        }
    }

    handleClick(e) {
        const pos = this.getCanvasPosition(e.clientX, e.clientY);
        const node = this.network.getNodeAtPosition(pos.x, pos.y);

        if (node) {
            this.network.selectedNode = node;
            this.updateNodeDetails(node);
        }
    }

    handleTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const pos = this.getCanvasPosition(touch.clientX, touch.clientY);
        const node = this.network.getNodeAtPosition(pos.x, pos.y);

        if (this.isAddingNode) {
            this.phantomNode = { x: pos.x, y: pos.y };
        } else if (node) {
            this.network.draggedNode = node;
            this.network.selectedNode = node;
            this.updateNodeDetails(node);
        } else {
            this.isDragging = true;
            this.lastMousePos = { x: touch.clientX, y: touch.clientY };
        }
    }

    handleTouchMove(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const pos = this.getCanvasPosition(touch.clientX, touch.clientY);

        if (this.isAddingNode && this.phantomNode) {
            this.phantomNode.x = pos.x;
            this.phantomNode.y = pos.y;
        } else if (this.network.draggedNode) {
            this.network.moveNode(this.network.draggedNode.id, pos.x, pos.y);
        } else if (this.isDragging) {
            const dx = touch.clientX - this.lastMousePos.x;
            const dy = touch.clientY - this.lastMousePos.y;
            this.offset.x += dx;
            this.offset.y += dy;
            this.lastMousePos = { x: touch.clientX, y: touch.clientY };
        }
        this.render();
    }

    handleTouchEnd(e) {
        e.preventDefault();
        const touch = e.changedTouches[0];
        const pos = this.getCanvasPosition(touch.clientX, touch.clientY);

        if (this.isAddingNode && this.phantomNode) {
            const node = this.network.addNode(pos.x, pos.y);
            this.phantomNode = null;
            this.isAddingNode = false;
            this.network.selectedNode = node;
            this.updateNodeDetails(node);
        } else if (this.edgeCreationState.isActive) {
            const targetNode = this.network.getNodeAtPosition(pos.x, pos.y);
            if (targetNode && targetNode.id !== this.edgeCreationState.sourceNode.id) {
                
                if (!this.network.edgeExists(this.edgeCreationState.sourceNode.id, targetNode.id)) {
                    const edgeTypeSelector = document.getElementById('edgeTypeSelector');
                    const isBidirectional = edgeTypeSelector && edgeTypeSelector.value === 'double';
                    this.network.connectNodes(this.edgeCreationState.sourceNode.id, targetNode.id, 1, isBidirectional);
                    this.network.selectedNode = targetNode;
                    this.updateNodeDetails(targetNode);
                }
            }
            this.edgeCreationState = {
                isActive: false,
                sourceNode: null,
                previewPos: null
            };
        }
        this.network.draggedNode = null;
        this.isDragging = false;
        this.render();
    }

    handleZoom(e) {
        e.preventDefault();
        const delta = e.deltaY;
        const scaleFactor = delta > 0 ? 0.9 : 1.1;
        this.scale *= scaleFactor;
        this.scale = Math.max(0.1, Math.min(5, this.scale));
        this.render();
    }

    getCanvasPosition(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: ((clientX - rect.left - this.offset.x) / this.scale),
            y: ((clientY - rect.top - this.offset.y) / this.scale)
        };
    }

    getNodeAtPosition(x, y) {
        const radius = this.nodeRadius;
        for (const node of this.network.nodes.values()) {
            const dx = x - node.x;
            const dy = y - node.y;
            if (dx * dx + dy * dy <= radius * radius) {
                return node;
            }
        }
        return null;
    }

    updateNodeDetails(node) {
        const nodeInfo = document.getElementById('nodeInfo');
        const routingTable = document.getElementById('routingTable');
        const removeNodeBtn = document.getElementById('removeNode');
        
        if (!node) {
            nodeInfo.innerHTML = '<p>No node selected</p>';
            routingTable.innerHTML = '';
            removeNodeBtn.disabled = true;
            return;
        }
        
        removeNodeBtn.disabled = false;
        
        
        let html = `
            <div>
                <strong>Router ${node.id}</strong>
            </div>
            <div>
                Network: 10.0.${node.id}.0/24
            </div>
            <div>
                Router IP: 10.0.${node.id}.1
            </div>
            <div>
                Position: (${Math.round(node.x)}, ${Math.round(node.y)})
            </div>
            <div>
                Neighbors: ${node.neighbors.size}
            </div>
            <div>
                LSA Sequence: ${node.lsa_seq}
            </div>
            <div>
                LSA Database Size: ${Object.keys(node.lsa_db).length}
            </div>
            <div class="neighbor-list">
                <h3>Neighbors</h3>
        `;
        
        
        if (node.neighbors.size > 0) {
            for (const [neighborId, data] of node.neighbors.entries()) {
                html += `
                    <div class="neighbor-item">
                        <div>
                            Router ${neighborId} (10.0.${neighborId}.0/24)
                            <span>Weight: ${data.weight}</span>
                        </div>
                        <div>
                            <button onclick="updateEdgeWeight(${node.id}, ${neighborId})">
                                Edit
                            </button>
                            <button onclick="deleteEdge(${node.id}, ${neighborId})">
                                Delete
                            </button>
                        </div>
                    </div>
                `;
            }
        } else {
            html += '<div>No neighbors connected</div>';
        }
        
        html += '</div>';
        nodeInfo.innerHTML = html;
        
        
        let rtHtml = `<h3>Routing Table</h3>`;
        
        
        rtHtml += `
            <table border="1" cellpadding="5" style="width:100%">
                <tr>
                    <th>Destination</th>
                    <th>Netmask</th>
                    <th>Gateway</th>
                    <th>Interface</th>
                </tr>
                <tr>
                    <td>10.0.${node.id}.0</td>
                    <td>255.255.255.0</td>
                    <td>10.0.${node.id}.1</td>
                    <td>eth0</td>
                </tr>
        `;
        
        
        if (node.routingTable.size > 0) {
            for (const [destId, route] of node.routingTable.entries()) {
                rtHtml += `
                    <tr>
                        <td>10.0.${destId}.0</td>
                        <td>255.255.255.0</td>
                        <td>${route.nextHop === node.id ? '10.0.' + node.id + '.1' : '10.0.' + route.nextHop + '.1'}</td>
                        <td>eth0</td>
                    </tr>
                `;
            }
        }
        
        rtHtml += `</table>`;
        
        
        if (node.routingTable.size > 0) {
            rtHtml += `<h3>Path Information</h3>`;
            for (const [destId, route] of node.routingTable.entries()) {
                rtHtml += `
                    <div style="margin-bottom:10px">
                        <div>Router ${destId} (10.0.${destId}.0/24) - Cost: ${route.cost}</div>
                        <div>Path: ${route.path.join(' → ')}</div>
                        <div>Next Hop: Router ${route.nextHop} (10.0.${route.nextHop}.1)</div>
                    </div>
                `;
            }
        } else {
            rtHtml += `<div>No routes available</div>`;
        }
        
        routingTable.innerHTML = rtHtml;
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        
        this.ctx.save();
        this.ctx.translate(this.offset.x, this.offset.y);
        this.ctx.scale(this.scale, this.scale);

        
        for (const node of this.network.nodes.values()) {
            for (const [neighborId, neighbor] of node.neighbors) {
                const neighborNode = this.network.nodes.get(neighborId);
                if (neighborNode) {
                    this.drawEdge(node, neighborNode, neighbor.weight);
                }
            }
        }

        
        this.drawPackets();

        
        for (const node of this.network.nodes.values()) {
            this.drawNode(node);
        }

        
        if (this.edgeCreationState.isActive && this.edgeCreationState.sourceNode && this.edgeCreationState.previewPos) {
            this.drawEdgePreview(this.edgeCreationState.sourceNode, this.edgeCreationState.previewPos);
        }

        this.ctx.restore();
    }

    drawNode(node) {
        this.ctx.beginPath();
        this.ctx.arc(node.x, node.y, this.nodeRadius, 0, Math.PI * 2);
        
        
        if (node.isIsolated) {
            this.ctx.fillStyle = '#808080'; 
            this.ctx.strokeStyle = '#555555';
            this.ctx.setLineDash([5, 2]); 
        } else if (node === this.network.selectedNode) {
            this.ctx.fillStyle = '#4CAF50'; 
            this.ctx.strokeStyle = '#000';
            this.ctx.setLineDash([]); 
        } else {
            this.ctx.fillStyle = '#2d2d2d'; 
            this.ctx.strokeStyle = node.isActive ? '#4CAF50' : '#666';
            this.ctx.setLineDash([]); 
        }
        
        this.ctx.fill();
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        this.ctx.setLineDash([]); 
        
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(node.id.toString(), node.x, node.y);
    }

    drawPhantomNode(node) {
        this.ctx.beginPath();
        this.ctx.arc(node.x, node.y, 20, 0, 2 * Math.PI);
        this.ctx.fillStyle = 'rgba(76, 175, 80, 0.3)';
        this.ctx.fill();
        this.ctx.strokeStyle = '#4CAF50';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }

    drawEdge(node1, node2, weight) {
        
        const isBidirectional = node2.neighbors.has(node1.id);
        
        
        this.ctx.beginPath();
        this.ctx.moveTo(node1.x, node1.y);
        this.ctx.lineTo(node2.x, node2.y);
        this.ctx.strokeStyle = '#666';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        
        if (!isBidirectional) {
            
            const dx = node2.x - node1.x;
            const dy = node2.y - node1.y;
            const angle = Math.atan2(dy, dx);
            
            
            const midX = (node1.x + node2.x) / 2;
            const midY = (node1.y + node2.y) / 2;
            
            
            const arrowSize = 20;
            
            
            this.ctx.beginPath();
            this.ctx.moveTo(midX + arrowSize/2 * Math.cos(angle), midY + arrowSize/2 * Math.sin(angle));
            this.ctx.lineTo(
                midX - arrowSize/2 * Math.cos(angle - Math.PI/6),
                midY - arrowSize/2 * Math.sin(angle - Math.PI/6)
            );
            this.ctx.lineTo(
                midX - arrowSize/2 * Math.cos(angle + Math.PI/6),
                midY - arrowSize/2 * Math.sin(angle + Math.PI/6)
            );
            this.ctx.closePath();
            this.ctx.fillStyle = '#666'; 
            this.ctx.fill();
            this.ctx.strokeStyle = '#444'; 
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
        }
        
        
        const midX = (node1.x + node2.x) / 2;
        const midY = (node1.y + node2.y) / 2;
        
        
        const weightOffsetY = !isBidirectional ? 15 : 0;
        
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(weight.toString(), midX, midY - weightOffsetY);
    }

    drawEdgePreview(sourceNode, targetPos) {
        this.ctx.beginPath();
        this.ctx.moveTo(sourceNode.x, sourceNode.y);
        this.ctx.lineTo(targetPos.x, targetPos.y);
        this.ctx.strokeStyle = '#4CAF50';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }

    drawPackets() {
        
        for (const packet of this.network.helloPackets) {
            const sourceNode = this.network.nodes.get(packet.sourceId);
            const targetNode = this.network.nodes.get(packet.targetId);
            
            if (sourceNode && targetNode && sourceNode.neighbors.has(targetNode.id)) {
                const startX = sourceNode.x;
                const startY = sourceNode.y;
                const endX = targetNode.x;
                const endY = targetNode.y;
                
                const currentX = startX + (endX - startX) * packet.progress;
                const currentY = startY + (endY - startY) * packet.progress;
                
                this.ctx.beginPath();
                this.ctx.arc(currentX, currentY, 5, 0, Math.PI * 2);
                this.ctx.fillStyle = '#4CAF50'; 
                this.ctx.fill();
                
                this.ctx.beginPath();
                this.ctx.moveTo(startX, startY);
                this.ctx.lineTo(currentX, currentY);
                this.ctx.strokeStyle = 'rgba(76, 175, 80, 0.3)'; 
                this.ctx.stroke();
            }
        }
        
        
        for (const packet of this.network.lsaPackets) {
            const receivedFromNode = this.network.nodes.get(packet.receivedFrom);
            const targetNode = this.network.nodes.get(packet.targetId);
            
            
            if (receivedFromNode && targetNode && 
                receivedFromNode.neighbors.has(targetNode.id) && 
                targetNode.neighbors.has(receivedFromNode.id)) {
                
                const startX = receivedFromNode.x;
                const startY = receivedFromNode.y;
                const endX = targetNode.x;
                const endY = targetNode.y;
                
                const currentX = startX + (endX - startX) * packet.progress;
                const currentY = startY + (endY - startY) * packet.progress;
                
                
                this.ctx.beginPath();
                this.ctx.arc(currentX, currentY, 6, 0, Math.PI * 2);
                this.ctx.fillStyle = '#2196F3'; 
                this.ctx.fill();
                
                
                this.ctx.beginPath();
                this.ctx.moveTo(startX, startY);
                this.ctx.lineTo(currentX, currentY);
                this.ctx.strokeStyle = 'rgba(33, 150, 243, 0.3)'; 
                this.ctx.stroke();
                
                
                this.ctx.fillStyle = '#fff';
                this.ctx.font = '10px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(packet.lsa.sourceId, currentX, currentY);
            }
        }
    }


    resetView() {
        this.scale = this.defaultScale;
        this.offset = { x: 700, y: 300 };
        this.render();
    }

    updateNodeStyle(nodeId) {
        const node = this.network.nodes.get(nodeId);
        const nodeElem = this.svg.select(`#node-${nodeId}`);
        
        if (!nodeElem.empty()) {
            
            if (node.isIsolated) {
                nodeElem.select('circle')
                    .attr('fill', this.nodeIsolatedColor)
                    .attr('stroke', '#555555')
                    .attr('stroke-width', 2)
                    .attr('stroke-dasharray', '5,2');
            } else if (nodeId === this.selectedNodeId) {
                
                nodeElem.select('circle')
                    .attr('fill', this.nodeSelectedColor)
                    .attr('stroke', '#000')
                    .attr('stroke-width', 2)
                    .attr('stroke-dasharray', null);
            } else {
                
                nodeElem.select('circle')
                    .attr('fill', this.nodeNormalColor)
                    .attr('stroke', '#000')
                    .attr('stroke-width', 1)
                    .attr('stroke-dasharray', null);
            }
        }
    }
} 