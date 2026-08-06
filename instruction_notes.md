Dataset notes:

Provider level:

Extra calculated fields

1. provider_licensed_inactive_time, provider_licensed_inactive_percent - flag providers that have a larger percent of the time inactive.
2. restrictive preferences can maybe be double checked or prompted to expand. Or maybe not... it is their preference after all.
3. Group by county - is there a trend by county of success vs failure in the above metrics? That might bring visibility into problem counties.

- county_average_inactive_time, county_average_inactive_percent

4.

Child level:

1. Removal date is I guess from their family? So discharge_date - removal_date = child_total_foster_time
2. Approximated total years - useful? Eh - days is more accurate than years, let's stick with just that and a cutoff_time constant of July 1st.
3. county_child_ages_count - grouped by county - a bucket for ages in which a child has been in care based on the county

- count: {
  [county_id]: Array(18)
  }
- compare this with incoming age preferences - if the range only includes uncommon ages, suggest changing preferences.
- maybe not needed, maybe too complicated.

Placement level:

1. child_num_placements - take max(placement_index)
2. child_num_external_placements - when removal_county != placement_county
3. child_adverse_placement_percent

- nonfamily, foster_home, and child_external_placements entries, their duration, divided by overall time in placement of child (found in child_level.csv)

4. county_adverse_placement_percent - grouped by county
5.

Recruiter Goals:

1. Find more providers - outreach - how?

- How to find potential homes? Some data bank? Online user data from advertisement companies to find potential foster home candidates?
- Outreach - multi-pronged - email to discuss, cold call

2. Align provider preference w/ child demographics - roughly common age range and w/ mental/behavioral needs
3.
