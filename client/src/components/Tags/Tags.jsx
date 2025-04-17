import React from 'react'
import Chip from '@mui/material/Chip';
import { getUser } from '../../Services/userService';
export default function Tags({tags }) {
  return (
    <>
        {
            tags.map( (tag) => 
                <Chip sx={{margin:"0.3rem"}} key={tag.name} label={tag.name + " " + tag.count} component="a" href={`/tag/${tag.name}`} clickable />
            )
        }
    </>
  )
}
// get all favourites by just clicking on the chip
// all other are fixed 