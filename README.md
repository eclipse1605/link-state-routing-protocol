# Link-State Routing Simulator

An interactive web-based simulator for understanding and visualizing link-state routing protocols in computer networks.

## Features

### Network Manipulation
- **Add Nodes**: Click the "Add Node" button and then click anywhere on the canvas to place a router
- **Move Nodes**: Click and drag any router to reposition it
- **Remove Nodes**: Select a router and click the "Remove Node" button to delete it and all its connections
- **Add Edges**: 
  - Click the "Add Edge" button
  - Click on a source router
  - Drag to the destination router
  - Enter the edge weight in the popup dialog
- **Edit Edge Weights**: Click the edit (pencil) icon next to any neighbor in the router details panel
- **Delete Edges**: Click the delete (trash) icon next to any neighbor in the router details panel

### Simulation
- **Start/Stop**: Toggle the simulation using the Start/Stop button
- **Hello Packets**: Visualizes hello packet transmission between routers during simulation
- **LSA Updates**: Shows Link State Advertisement updates as routers communicate
- **Real-time Updates**: Routing tables are updated automatically as the network topology changes

### Visualization
- **Router Details**: Shows detailed information about the selected router:
  - Router ID
  - Position coordinates
  - Number of neighbors
  - LSA sequence number
  - LSA database size
  - List of neighbors with weights
- **Routing Table**: Displays the current routing table for the selected router:
  - Destination router
  - Path cost
  - Complete path
  - Next hop
- **Reset View**: Centers the network in the canvas with default zoom level
- **Clear Network**: Removes all routers and edges to start fresh

## Interface Layout

- **Top Toolbar**: Contains network editing tools on the left, simulation controls in the center, and logs on the right
- **Bottom Right Panel**: Shows node details and routing tables for the selected router
- **Bottom Left Controls**: Reset View and Clear Network buttons for quick access
- **Responsive Design**: Works well on different screen sizes

## Usage Instructions

1. **Creating a Network**:
   - Click "Add Node" to add routers
   - Use "Add Edge" to connect routers
   - Adjust edge weights as needed

2. **Modifying the Network**:
   - Drag routers to reposition them
   - Select a router to view/edit its details
   - Edit edge weights or delete connections from the router details panel
   - Remove routers using the "Remove Node" button

3. **Running the Simulation**:
   - Click "Start Hello Phase" to begin neighbor discovery
   - After Hello Phase completes, start the LSA Flooding process
   - Observe hello packets and LSA updates
   - Watch routing tables update automatically

4. **View Management**:
   - Use the "Reset View" button to center the network view
   - Click and drag empty space to pan the view
   - Use mouse wheel to zoom in/out

## Implementation Details

The simulator implements the Link-State Routing protocol with the following components:

- **Routers**: Represented as nodes with unique IDs
- **Links**: Connections with weights (bidirectional or unidirectional)
- **LSA Database**: Each router maintains its own link-state database
- **Dijkstra's Algorithm**: Used for calculating shortest paths
- **Hello Protocol**: Simulated for neighbor discovery
- **LSA Flooding**: Implemented for topology information distribution

## Technical Notes

- Built with vanilla JavaScript
- Uses HTML5 Canvas for rendering
- Implements real-time graph visualization
- Supports dynamic network topology changes
- Provides interactive user interface for network manipulation

## Prerequisites

- Python 3.7 or higher
- pip (Python package installer)

## Installation

1. Clone or download this repository
2. Navigate to the project directory
3. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Running the Application

1. Start the Flask server:
   ```bash
   python app.py
   ```
2. Open your web browser and navigate to:
   ```
   http://localhost:5000
   ```

## To be implemented
1. Fixing import and export feature
2. Refactoring the code to be more consistent
3. Improved Error handling
4. More intuitive controls
5. Guide to keybindings
6. Custom keybindings