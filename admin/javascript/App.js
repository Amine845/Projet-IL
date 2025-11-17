import React from 'react';
import { userState } from 'react';

import searchbar from './searchbar';
import youtube from './youtube';
import videoList from './videolist';
import videoDetail from './videodetail';

import "./templates/style.css"

class App extends React.Component{
    state = {videos : [], selectedVideo : null, searchTerm : ''};

    // gère chaque changement d'input dans la search bar 
    handleInputChange = (event) => {
        this.setState({ searchTerm: event.target.value });
    };

    render(){
        return (
            <div className="ui container">
                    <div className="field">
                        <label>Barre de Recherche</label>
                        <input 
                            type="text"
                            value={this.state.searchTerm}
                            onChange={this.handleInputChange}
                            placeholder="Entrez votre recherche..."
                        />
                    </div>
                    <button type="submit">Rechercher</button>                
            </div>
        );
    }

}


export default App;