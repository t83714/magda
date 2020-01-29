import React, { useEffect, useState } from "react";
import { useAsyncCallback } from "react-async-hook";
import Select from "react-select";
import find from "lodash/find";

import ReactSelectStyles from "Components/Common/react-select/ReactSelectStyles";

import { listOrgUnits } from "api-clients/OrgUnitApis";

type Props = {
    orgUnitId?: string;
    custodianOrgUnitId?: string;
    onChange: (orgUnitId: string) => void;
};

export default function OrgUnitDropdown({
    orgUnitId,
    custodianOrgUnitId,
    onChange: onChangeCallback
}: Props) {
    // If we already have a value from orgUnitId we can assume the user already picked it.
    const [hasUserSelected, setHasUserSelected] = useState(!!orgUnitId);

    // Set up the call for loading org units, but don't call it yet.
    const { loading, error, result, execute } = useAsyncCallback(() =>
        listOrgUnits({
            orgUnitsOnly: true,
            relationshipOrgUnitId: custodianOrgUnitId
        })
    );

    // We don't need to load org units unless we're starting up (!result) or
    // the user hasn't selected a custodian yet (which means we need to do another
    // call every time they change the team responsible in order to preselect
    // the corresponding custodian org unit).
    useEffect(() => {
        if (!result || !hasUserSelected) {
            execute();
        }
    }, [custodianOrgUnitId]);

    if (loading) {
        return <span>Loading...</span>;
    } else if (error || !result || result.length === 0) {
        return (
            <div className="au-body au-page-alerts au-page-alerts--error">
                <span style={{ verticalAlign: "-2px" }}>
                    Could not retrieve data custodian list, or there are no data
                    custodians in the system.
                </span>
                <button className="au-btn au-btn--tertiary" onClick={execute}>
                    Try Again
                </button>
            </div>
        );
    } else {
        const selectedValue =
            typeof orgUnitId !== "undefined" &&
            find(result, option => option.id === orgUnitId);

        // --- default to list options alphabetically
        let sortedResult = result.sort((b, a) =>
            a.name > b.name ? -1 : b.name > a.name ? 1 : 0
        );
        if (custodianOrgUnitId) {
            sortedResult = sortedResult
                .filter(item => item.relationship !== "unrelated")
                .concat(
                    sortedResult.filter(
                        item => item.relationship === "unrelated"
                    )
                );
        }

        return (
            <Select
                className="react-select"
                isMulti={false}
                isSearchable={true}
                onChange={(rawValue, action) => {
                    const value = rawValue as
                        | { value: string }
                        | undefined
                        | null;
                    if (value) {
                        setHasUserSelected(true);
                        onChangeCallback(value.value);
                    }
                }}
                styles={ReactSelectStyles}
                value={
                    selectedValue
                        ? {
                              label: selectedValue.name,
                              value: selectedValue.id
                          }
                        : undefined
                }
                options={sortedResult.map(option => ({
                    label: option.name,
                    value: option.id
                }))}
                placeholder="Select a team"
            />
        );
    }
}
