import React, { Component } from "react";
import FacetHeader from "./FacetHeader";
import FacetBasicBody from "./FacetBasicBody";

// extends Facet class
class FacetBasic extends Component {
    constructor(props) {
        super(props);
        // create a ref to store the textInput DOM element
        this.facetHeader = React.createRef();
        this.updateComponentAlignment = this.updateComponentAlignment.bind(
            this
        );
        this.state = { marginLeft: null, alignment: null };
    }

    updateComponentAlignment(offsetLeft) {
        // get the absolute position of this facet header

        //in order to decide whether facet should be open from left or right, we need to detect where the
        // facet header is, to prevent the facet being shown before moving

        // we judge where the component is by checking if it's on left or right half of the page.
        // This will work because the facets are 2x3 stacked

        // we then pass on that knowledge to the actual facet dropdown

        const newAlignment =
            offsetLeft >= window.innerWidth / 2 ? "right" : "left";
        if (newAlignment !== this.state.alignment) {
            this.setState({
                alignment: newAlignment
            });
        }
    }

    render() {
        function resetAndToggle() {
            this.props.searchFacet();
            this.props.toggleFacet();
        }
        return (
            <div className="facet-wrapper">
                <FacetHeader
                    isOpen={this.props.isOpen}
                    onResetFacet={this.props.onResetFacet}
                    id={this.props.id}
                    title={this.props.title}
                    activeOptions={this.props.activeOptions}
                    hasQuery={this.props.hasQuery}
                    onClick={resetAndToggle.bind(this)}
                    ref={this.facetHeader}
                    updateComponentAlignment={this.updateComponentAlignment}
                />
                <FacetBasicBody
                    isOpen={this.props.isOpen}
                    options={this.props.options}
                    activeOptions={this.props.activeOptions}
                    facetSearchResults={this.props.facetSearchResults}
                    onToggleOption={this.props.onToggleOption}
                    onResetFacet={this.props.onResetFacet}
                    searchFacet={this.props.searchFacet}
                    toggleFacet={this.props.toggleFacet}
                    title={this.props.title}
                    resetFilterEvent={this.props.resetFilterEvent}
                    closeFacet={this.props.closeFacet}
                    alignment={this.state.alignment}
                />
            </div>
        );
    }
}

export default FacetBasic;
