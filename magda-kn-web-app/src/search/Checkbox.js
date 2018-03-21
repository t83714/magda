import React, {Component } from 'react'

import {Badge } from 'react-bootstrap'
import './SearchResult.css'

class Checkbox extends Component {
    state = {
      isChecked: false,
    }
  
    toggleCheckboxChange = () => {
      const { handleCheckboxChange, label } = this.props;
  
      this.setState(({ isChecked }) => (
        {
          isChecked: !isChecked,
        }
      ));
  
      handleCheckboxChange(label);
    }
  
    render() {
      const { label, hitCount } = this.props;
      const { isChecked } = this.state;
  
      return (
          <label>
            <input
                type="checkbox"
                value={label}
                checked={isChecked}
                onChange={this.toggleCheckboxChange}
            />
            {label}
            <Badge bsClass="badge-success" pullRight>{hitCount}</Badge>
          </label>
      );
    }
  }
  
  export default Checkbox;